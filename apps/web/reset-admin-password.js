#!/usr/bin/env node
/**
 * 重置管理员密码工具
 * 用法: node reset-admin-password.js <新密码>
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function resetAdminPassword(newPassword) {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  const dbPath = path.join(__dirname, 'data', 'site.db');

  if (!fs.existsSync(dbPath)) {
    console.error('❌ 数据库文件不存在:', dbPath);
    process.exit(1);
  }

  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  // 检查管理员
  const adminRes = db.exec('SELECT id, username FROM admins LIMIT 1');
  if (!adminRes.length || !adminRes[0].values.length) {
    console.error('❌ 数据库中没有管理员账号');
    db.close();
    process.exit(1);
  }

  const adminId = adminRes[0].values[0][0];
  const username = adminRes[0].values[0][1];

  // 生成新密码哈希
  const newHash = bcrypt.hashSync(newPassword, 10);

  // 更新密码
  db.run('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, adminId]);

  // 保存数据库
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  db.close();

  console.log('✅ 密码重置成功！');
  console.log('   用户名:', username);
  console.log('   新密码:', newPassword);
  console.log('\n请使用上述凭据登录: http://localhost:3000/admin/login');
}

const newPassword = process.argv[2];

if (!newPassword) {
  console.error('用法: node reset-admin-password.js <新密码>');
  console.error('示例: node reset-admin-password.js MyNewPassword123');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('❌ 密码至少需要 6 位');
  process.exit(1);
}

resetAdminPassword(newPassword).catch(err => {
  console.error('❌ 重置失败:', err.message);
  process.exit(1);
});
