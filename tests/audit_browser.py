"""Regression checks against the disposable API at 4001 and built web at 3001.

Creates test accounts/orders in brewlite_test only. History display also uses
explicit response fixtures; those checks do not claim database integration.
"""
import json
import uuid
from playwright.sync_api import sync_playwright, expect

API = 'http://localhost:4001'
WEB = 'http://localhost:3001'


def account(context):
    email = f'audit-browser-{uuid.uuid4()}@test.local'
    body = {'email': email, 'password': 'Audit-browser-123', 'name': 'Audit browser'}
    response = context.request.post(API + '/auth/register', data=body)
    assert response.status == 201, response.text()
    return context.request.post(API + '/auth/login', data=body).json()['accessToken']


def set_cart(page, items):
    page.evaluate('items => localStorage.setItem("brewlite-cart", JSON.stringify({state: {items}, version: 0}))', items)


def history(context, token):
    return context.request.get(API + '/orders/me', headers={'Authorization': 'Bearer ' + token}).json()


def ready(page, path='/checkout'):
    page.goto(WEB + path)
    page.wait_for_load_state('networkidle')


def report(name):
    print(json.dumps({'scenario': name, 'status': 'PASS'}), flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        # Recover an order whose response was lost, then change the cart.
        context = browser.new_context()
        token = account(context)
        products = context.request.get(API + '/products').json()
        first, second = products[:2]
        page = context.new_page()
        lost = [False]

        def lost_order(route):
            path = route.request.url.removeprefix('http://localhost:4000')
            response = route.fetch(url=API + path)
            if path == '/orders' and route.request.method == 'POST' and not lost[0]:
                assert response.status == 201
                lost[0] = True
                route.abort('failed')
            else:
                route.fulfill(response=response)

        page.route('http://localhost:4000/**', lost_order)
        ready(page, '/')
        page.evaluate('token => localStorage.setItem("brewlite_access_token", token)', token)
        set_cart(page, [{'product': first, 'quantity': 1}])
        ready(page)
        assert page.locator('.pay-button').count() == 1
        page.locator('.pay-button').click()
        expect(page.locator('.form-error')).to_be_visible()
        old = history(context, token)
        assert len(old) == 1 and old[0]['status'] == 'PENDING'
        changed = [{'product': first, 'quantity': 2}, {'product': second, 'quantity': 1}]
        set_cart(page, changed)
        ready(page)
        page.locator('.pay-button').click()
        expect(page.locator('.form-error')).to_contain_text('chưa hoàn tất')
        assert len(history(context, token)) == 1
        assert page.evaluate('JSON.parse(localStorage.getItem("brewlite-cart")).state.items.length') == 2
        response = context.request.patch(API + f'/orders/{old[0]["id"]}/cancel', headers={'Authorization': 'Bearer ' + token})
        assert response.status == 200, response.text()
        page.locator('.pay-button').click()
        expect(page.locator('.confirmation-card')).to_be_visible()
        assert sorted(order['status'] for order in history(context, token)) == ['CANCELLED', 'PAID']
        report('changed cart blocks duplicate order until the old reservation is cancelled')
        context.close()

        # Items added from another tab during payment must survive confirmation.
        context = browser.new_context()
        token = account(context)
        page = context.new_page()

        def concurrent_cart(route):
            path = route.request.url.removeprefix('http://localhost:4000')
            response = route.fetch(url=API + path)
            if path == '/payments' and route.request.method == 'POST':
                assert response.status == 201
                set_cart(page, [{'product': first, 'quantity': 3}, {'product': second, 'quantity': 1}])
            route.fulfill(response=response)

        page.route('http://localhost:4000/**', concurrent_cart)
        ready(page, '/')
        page.evaluate('token => localStorage.setItem("brewlite_access_token", token)', token)
        set_cart(page, [{'product': first, 'quantity': 1}])
        ready(page)
        page.locator('.pay-button').click()
        expect(page.locator('.confirmation-card')).to_be_visible()
        remaining = page.evaluate('JSON.parse(localStorage.getItem("brewlite-cart")).state.items')
        assert [(item['product']['id'], item['quantity']) for item in remaining] == [(first['id'], 2), (second['id'], 1)]
        report('payment removes only purchased quantities and preserves additions')
        context.close()

        # A response for the previous account must never clear the new account's cart.
        context = browser.new_context()
        token = account(context)
        other_token = account(context)
        page = context.new_page()

        def switch_account(route):
            path = route.request.url.removeprefix('http://localhost:4000')
            response = route.fetch(url=API + path)
            if path == '/payments' and route.request.method == 'POST':
                assert response.status == 201
                page.evaluate('token => { localStorage.setItem("brewlite_access_token", token); window.dispatchEvent(new Event("brewlite:auth-change")); }', other_token)
            route.fulfill(response=response)

        page.route('http://localhost:4000/**', switch_account)
        ready(page, '/')
        page.evaluate('token => localStorage.setItem("brewlite_access_token", token)', token)
        set_cart(page, [{'product': first, 'quantity': 1}])
        ready(page)
        page.locator('.pay-button').click()
        expect(page.locator('.form-error')).to_contain_text('Tài khoản đã thay đổi')
        expect(page.locator('.confirmation-card')).to_have_count(0)
        assert page.evaluate('JSON.parse(localStorage.getItem("brewlite-cart")).state.items.length') == 1
        assert len(history(context, token)) == 1
        assert len(history(context, other_token)) == 0
        report('switching account during payment preserves the cart and separates order ownership')
        context.close()

        # Search and history presentation, with known fixtures for every state.
        context = browser.new_context()
        token = account(context)
        page = context.new_page()
        fixtures = [
            {'id': 42, 'status': 'PAID', 'total': 50000, 'payment': [
                {'id': 1, 'method': 'WALLET', 'status': 'FAILED', 'amount': 50000},
                {'id': 2, 'method': 'MOMO', 'status': 'PAID', 'amount': 50000}]},
            {'id': 43, 'status': 'PENDING', 'total': 70000, 'payment': []},
            {'id': 44, 'status': 'CANCELLED', 'total': 90000, 'payment': [
                {'id': 3, 'method': 'CREDIT_CARD', 'status': 'REFUNDED', 'amount': 90000}]},
        ]

        def presentation(route):
            path = route.request.url.removeprefix('http://localhost:4000')
            if path == '/orders/me':
                route.fulfill(status=200, json=fixtures)
            else:
                route.fulfill(response=route.fetch(url=API + path))

        page.route('http://localhost:4000/**', presentation)
        ready(page, '/')
        page.evaluate('token => localStorage.setItem("brewlite_access_token", token)', token)
        ready(page, '/?view=orders')
        expect(page.locator('.history-order')).to_have_count(3)
        spend = page.locator('.history-stat').filter(has_text='Đã chi tiêu')
        expect(spend).to_contain_text('50.000')
        expect(page.locator('.history-order').first).to_contain_text('Ví MoMo')
        page.get_by_label('Tìm theo mã đơn hàng').fill('BL00000042')
        expect(page.locator('.history-order')).to_have_count(1)
        expect(page.locator('.history-order')).to_contain_text('BL00000042')
        report('paid spending, MoMo after failed wallet attempt, and displayed order code search')

        ready(page, '/')
        assert len(products) > 16
        page.get_by_role('button', name='Tìm kiếm món', exact=True).click()
        page.get_by_label('Tìm món', exact=True).fill(products[16]['name'])
        expect(page.locator('.product-card').filter(has_text=products[16]['name']).first).to_be_visible()
        report('home search finds a product after position 16')
        context.close()
    finally:
        browser.close()
