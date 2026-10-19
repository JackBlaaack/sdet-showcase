import type { HeaderComponent } from '../UI/pages/header.component.js';
import type { LoginPage } from '../UI/pages/login.page.js';
import type { Shop } from './shop.interface.js';

/** Fixtures that seed a shop for one test. Both layers extend `test` with these. */
export interface ShopFixture {
  shop: Shop;
}

/** Page objects that UI tests need. */
export interface UiPagesFixture {
  loginPage: LoginPage;
  header: HeaderComponent;
}
