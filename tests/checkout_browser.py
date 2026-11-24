"""Run only against a disposable test API at 4001 and the built web app at 3001.

Requires Python Playwright and installed Chrome. Creates test accounts/orders.
All browser requests to the default API port 4000 are redirected to test port 4001.
"""
import json
import uuid
from playwright.sync_api import sync_playwright, expect

API = 'http://localhost:4001'
WEB = 'http://localhost:3001'

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    try:
        for method, lose_response in [('WALLET', False), ('CREDIT_CARD', False), ('WALLET', True)]:
            context = browser.new_context()
            email = f'browser-{uuid.uuid4()}@test.local'
            password = 'Browser-test-123'
            registered = context.request.post(API + '/auth/register', data={'email': email, 'password': password, 'name': 'Browser test'})
            assert registered.status == 201, registered.text()
            login = context.request.post(API + '/auth/login', data={'email': email, 'password': password})
            token = login.json()['accessToken']
            product = context.request.get(API + '/products').json()[0]
            page = context.new_page()
            lost = [False]
            order_keys = []
            payment_keys = []
            order_total = [None]

            def proxy(route):
                path = route.request.url.removeprefix('http://localhost:4000')
                response = route.fetch(url=API + path)
                if route.request.method == 'POST' and path == '/orders':
                    order_keys.append(route.request.headers['idempotency-key'])
                    order_total[0] = response.json()['order']['total']
                if route.request.method == 'POST' and path == '/payments':
                    payment_keys.append(route.request.headers['idempotency-key'])
                    assert route.request.post_data_json['method'] == method
                    assert route.request.post_data_json['amount'] == order_total[0]
                    if lose_response and not lost[0]:
                        assert response.status == 201
                        lost[0] = True
                        route.abort('failed')
                        return
                route.fulfill(response=response)

            page.route('http://localhost:4000/**', proxy)
            page.goto(WEB)
            page.wait_for_load_state('networkidle')
            page.evaluate('''({token, product}) => {
                localStorage.setItem('brewlite_access_token', token);
                localStorage.setItem('brewlite-cart', JSON.stringify({state: {items: [{product, quantity: 1}]}, version: 0}));
            }''', {'token': token, 'product': product})
            page.goto(WEB + '/checkout')
            page.wait_for_load_state('networkidle')
            # Inspect the rendered buttons before interacting with checkout.
            assert page.locator('.payment-option').count() == 2
            if method == 'CREDIT_CARD':
                page.locator('.payment-option').nth(1).click()
            page.locator('.pay-button').click()
            if lose_response:
                expect(page.locator('.form-error')).to_be_visible()
                assert lost[0]
                page.reload()
                page.wait_for_load_state('networkidle')
                page.locator('.pay-button').click()
            expect(page.locator('.confirmation-card')).to_be_visible()
            assert len(set(order_keys)) == 1
            assert len(set(payment_keys)) == 1
            assert len(order_keys) == (2 if lose_response else 1)
            history = context.request.get(API + '/orders/me', headers={'Authorization': 'Bearer ' + token}).json()
            assert len(history) == 1 and history[0]['status'] == 'PAID'
            assert len(history[0]['payment']) == 1
            assert page.evaluate("JSON.parse(localStorage.getItem('brewlite-cart')).state.items.length") == 0
            print(json.dumps({'method': method, 'lost_response_reload': lose_response, 'status': 'PASS'}))
            context.close()
    finally:
        browser.close()
