'use strict';
/**
 * 仅用于在 Next 服务端绕过 Webpack 对 sql.js / createRequire 的错误改写。
 * 勿删；路径相对于 apps/web/package.json 所在目录。
 */
const { createRequire } = require('module');
const path = require('path');
const pkgJson = path.join(__dirname, 'package.json');
const nodeRequire = createRequire(pkgJson);
const sqljs = nodeRequire('sql.js');
module.exports = typeof sqljs === 'function' ? sqljs : sqljs.default;
