
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "redirectTo": "/login",
    "route": "/"
  },
  {
    "renderMode": 2,
    "route": "/login"
  },
  {
    "renderMode": 2,
    "route": "/register"
  },
  {
    "renderMode": 2,
    "route": "/dashboard"
  },
  {
    "renderMode": 2,
    "route": "/order"
  },
  {
    "renderMode": 2,
    "route": "/product"
  },
  {
    "renderMode": 2,
    "route": "/cart"
  },
  {
    "renderMode": 2,
    "route": "/customer"
  },
  {
    "renderMode": 2,
    "route": "/checkout"
  },
  {
    "renderMode": 2,
    "route": "/payment"
  },
  {
    "renderMode": 2,
    "route": "/supplier"
  },
  {
    "renderMode": 2,
    "redirectTo": "/login",
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 614, hash: '4ed980460a46cb095ffe156ac4baeac7447d477dada08078811da2c3b355e947', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1127, hash: '302b001cf4b63ad7a5143bee298ac6ffe825f496c27ef4654273bb67072bd919', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'register/index.html': {size: 3329, hash: 'e7c67e2863dc93240e06ce96d01aff11751aa6ea11335784d2f7d799190db0c5', text: () => import('./assets-chunks/register_index_html.mjs').then(m => m.default)},
    'login/index.html': {size: 5403, hash: '95ed7925c09438bff85c3d016db73d09151f0458b93241c16d5e8cb318febfe0', text: () => import('./assets-chunks/login_index_html.mjs').then(m => m.default)},
    'styles-5INURTSO.css': {size: 0, hash: 'menYUTfbRu8', text: () => import('./assets-chunks/styles-5INURTSO_css.mjs').then(m => m.default)}
  },
};
