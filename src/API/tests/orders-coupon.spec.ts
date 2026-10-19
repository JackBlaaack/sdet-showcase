import { constants as http } from 'node:http2';
import {
  validateOrder,
  validateProduct,
} from '../../../utils/validators.js';
import { DataProvider } from '../../../utils/data-provider.js';
import {
  orderCreate,
  orderCreateExpected,
} from '../dto/order-create.dto.js';
import { expect, test } from '../fixtures/shop.fixture.js';

const orderProvider = new DataProvider(orderCreate);
const orderExpectedProvider = new DataProvider(orderCreateExpected);

test.describe(
  'API - Orders',
  {
    tag: ['@api', '@e2e', '@orders', '@coupons', '@allure.label.layer:api'],
  },
  () => {
    test('Order with a percent coupon is discounted and reserves stock', async ({
      shop,
    }) => {
      const { api, customer, product, coupon } = shop;

      const order = await test.step('Create an order of 2 items with the coupon', async () => {
        const response = await api.createOrder(
          customer.token,
          orderProvider.getData('DEFAULT_ORDER_CREATE', {
            productId: product.id,
            couponCode: coupon.code,
          }),
        );
        expect(response.status, response.text).toBe(http.HTTP_STATUS_CREATED);
        return response.data;
      });

      await test.step('Response matches the Order contract', async () => {
        expect(
          validateOrder(order),
          JSON.stringify(validateOrder.errors, null, 2),
        ).toBe(true);
      });

      await test.step('Prices reflect the coupon', async () => {
        // toMatchObject checks the length of items too: exactly one line is expected
        expect(order).toMatchObject(
          orderExpectedProvider.getData('DEFAULT_ORDER_CREATE', {
            userId: customer.id,
            productId: product.id,
            couponCode: coupon.code,
          }),
        );
      });

      await test.step('Stock of the product is reserved', async () => {
        const response = await api.getProduct(product.id);
        expect(response.status, response.text).toBe(http.HTTP_STATUS_OK);
        const reserved = response.data;
        expect(
          validateProduct(reserved),
          JSON.stringify(validateProduct.errors, null, 2),
        ).toBe(true);
        expect(reserved.stock, '5 in stock minus 2 ordered').toBe(3);
      });
    });
  },
);
