import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
// Optional QA dependency isolated from the app's dependency graph and pnpm lockfile.
const playwright = require(process.env.PLAYWRIGHT_CORE_PATH || resolve('.preview/p2-browser/node_modules/playwright-core'));
const output = resolve('.preview/p2-checks'); mkdirSync(output, { recursive: true });
const edge = process.env.BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
if (!existsSync(edge)) throw new Error('Set BROWSER_EXECUTABLE to an installed Chromium/Edge binary.');
const log = [], errors = [];
const browser = await playwright.chromium.launch({ executablePath: edge, headless: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
async function server(mode) {
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port; await new Promise(r => probe.close(r));
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, NEXT_PUBLIC_DATA_SOURCE: mode }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let text = ''; child.stdout.on('data', b => text += b); child.stderr.on('data', b => text += b);
  const base = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 40; i++) { try { if ((await fetch(base + '/login')).ok) return { child, base }; } catch {} await wait(300); }
  child.kill(); throw new Error(text);
}
async function login(page, base) {
  await page.goto(base + '/login'); await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL('**/today'); await page.getByRole('heading', { name: '今天先做什么？' }).waitFor();
}
async function noOverflow(page) {
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
  assert.ok(sizes.scroll <= sizes.width + 1, JSON.stringify(sizes));
}
let mock, live, context;
try {
  mock = await server('mock');
  context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const apiRequests = []; page.on('request', r => { if (r.url().includes('/api/v1/')) apiRequests.push(r.url()); });
  await login(page, mock.base);
  await page.locator('.sidebar').getByRole('link', { name: /代码练习/ }).click();
  await page.getByRole('heading', { name: '提交历史', exact: true }).waitFor();
  await page.getByLabel('评审状态').selectOption('failed');
  await page.getByText('当前筛选共 1 条记录').waitFor();
  await page.locator('a[href="/practice/01"]').click();
  await page.getByRole('heading', { name: '暂时无法完成评审' }).waitFor();
  await page.getByRole('button', { name: '重试本次评审' }).click();
  await page.waitForURL(/review=/);
  await page.reload();
  await page.getByRole('heading', { name: '评分结果', exact: true }).waitFor({ timeout: 20000 });
  assert.equal(await page.getByText('演示评审服务暂时不可用，提交内容已保留。', { exact: false }).count() > 0, true);
  log.push('failed retry appends attempt; refresh resumes result');

  await page.goto(mock.base + '/practice/04');
  await page.getByRole('heading', { name: '评分结果', exact: true }).waitFor();
  const summary = page.getByText('评审过程摘要 · 读取范围与处理步骤', { exact: true });
  await summary.focus(); await page.keyboard.press('Enter');
  await page.reload(); await summary.waitFor();
  assert.equal(await summary.evaluate(el => el.parentElement.open), true);
  await page.getByRole('button', { name: /solution.py · 第/ }).click();
  assert.ok(await page.locator('[data-highlight="true"]').count() > 0);
  const improve = page.getByRole('checkbox', { name: '已完成' }).first(); await improve.check();
  await page.getByText('演示改进状态已保存。', { exact: true }).waitFor();
  await page.getByLabel('你会如何设计边界用例来验证这份代码？').fill('增加空值与过期边界用例。');
  await page.getByRole('button', { name: '保存回答', exact: true }).first().click();
  await page.getByText('演示追问回答已保存。', { exact: true }).waitFor();
  await page.reload(); await page.getByRole('heading', { name: '评分结果', exact: true }).waitFor();
  assert.ok(await page.getByRole('checkbox', { name: '已完成' }).first().isChecked());
  assert.equal(await page.getByLabel('你会如何设计边界用例来验证这份代码？').inputValue(), '增加空值与过期边界用例。');
  log.push('keyboard process toggle persists; evidence navigation and improvement/followup persistence');

  await page.getByRole('link', { name: '修改并新建提交' }).click();
  await page.getByLabel('题目名称').fill('浏览器验收提交');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.getByText('演示草稿已保存，刷新可恢复。', { exact: true }).waitFor();
  await page.reload(); await page.getByLabel('题目名称').waitFor();
  assert.equal(await page.getByLabel('题目名称').inputValue(), '浏览器验收提交');
  await page.getByLabel('通过用例数', { exact: true }).fill('8');
  await page.getByRole('button', { name: '提交并开始演示评审' }).click();
  await page.getByText('通过数需为非负整数，且不能大于总数。', { exact: true }).waitFor();
  const beforeFile = await page.getByLabel('粘贴代码', { exact: true }).inputValue();
  await page.getByLabel('或选择文本代码文件（最大 200 KiB）').setInputFiles({ name: 'too-big.py', mimeType: 'text/plain', buffer: Buffer.alloc(210000, 'x') });
  assert.equal(await page.getByLabel('粘贴代码', { exact: true }).inputValue(), beforeFile);
  await page.getByLabel('或选择文本代码文件（最大 200 KiB）').setInputFiles({ name: 'sample.py', mimeType: 'text/plain', buffer: Buffer.from('print("demo")\n') });
  await page.getByLabel('代码文件名', { exact: true }).filter({ visible: true }).waitFor();
  await page.getByLabel('自测情况', { exact: true }).selectOption('untested');
  await page.getByRole('checkbox', { name: '本次代码由我本人独立完成' }).check();
  await page.getByRole('checkbox', { name: /我确认演示静态评审用途/ }).check();
  await page.getByRole('button', { name: '提交并开始演示评审' }).click();
  await page.waitForURL(url => /\/practice\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'));
  await page.getByRole('heading', { name: '评分结果', exact: true }).waitFor({ timeout: 20000 });
  await page.getByText('未提供自测。正确性、总分和等级不评定，不等于 0 分。', { exact: true }).waitFor();
  log.push('copy draft restore, validation, text-file import, untested submission and async completion');

  await page.goto(mock.base + '/practice/04'); await page.getByRole('heading', { name: '评分结果', exact: true }).waitFor();
  for (const [width, height] of [[1280,720],[584,761],[1440,900],[390,844],[1101,800],[1100,800],[861,800],[860,800],[641,800],[640,800],[421,800],[420,800]]) {
    await page.setViewportSize({ width, height }); await noOverflow(page);
    const code = await page.getByRole('heading', { name: '提交的代码', exact: true }).boundingBox();
    const score = await page.getByRole('heading', { name: '评分结果', exact: true }).boundingBox();
    assert.ok(code && score);
    if (width > 1100) { assert.ok(score.x > code.x); assert.ok(Math.abs(score.y - code.y) < 5); }
    else assert.ok(score.y > code.y);
    if (width > 860) {
      const main = await page.locator('.app-main').boundingBox(), sidebar = await page.locator('.sidebar').boundingBox();
      assert.ok(main.x >= sidebar.width - 1);
    } else {
      assert.equal(await page.locator('.sidebar').isVisible(), false);
      assert.equal(await page.locator('.mobile-nav').isVisible(), true);
    }
    if ([1280,584,1440,390].includes(width)) await page.screenshot({ path: resolve(output, 'review-' + width + '.png'), fullPage: true });
  }
  await page.setViewportSize({ width: 584, height: 761 });
  await page.getByText('功能目录', { exact: true }).click(); await page.getByRole('navigation', { name: '窄屏功能入口' }).getByRole('link', { name: '提交代码', exact: true }).click();
  await page.getByRole('heading', { name: '提交代码', exact: true }).waitFor(); await noOverflow(page);
  await page.screenshot({ path: resolve(output, 'form-584.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(mock.base + '/practice'); await page.getByRole('heading', { name: '提交历史', exact: true }).waitFor();
  await page.screenshot({ path: resolve(output, 'practice-584.png'), fullPage: true });
  log.push('12 viewport/breakpoint geometries, mobile directory, reduced motion, screenshots');

  await page.goto(mock.base + '/dashboard'); await page.getByRole('heading', { name: /近 30 天 · 平均评审分/ }).waitFor();
  await page.getByRole('group', { name: '代码统计周期' }).getByRole('button', { name: '近 7 天', exact: true }).click();
  await page.getByRole('heading', { name: /近 7 天 · 平均评审分/ }).waitFor(); await noOverflow(page);
  await page.screenshot({ path: resolve(output, 'dashboard-584.png'), fullPage: true });
  log.push('dashboard period switch independent of P1');
  await page.goto(mock.base + '/routes/1');
  await page.locator('a[href^="/practice/new?route="]').first().click();
  await page.getByLabel('题目名称', { exact: true }).waitFor();
  assert.ok((await page.getByLabel('题目名称', { exact: true }).inputValue()).length > 0);
  const completedP1 = await page.evaluate(() => JSON.parse(sessionStorage.getItem('persistlog:mock:p1:v1')).items.filter(i => i.status === 'completed').length);
  assert.equal(completedP1, 1, 'P2 submissions must not complete P1 tasks');
  log.push('P1 route-to-submission context works without automatically completing any P1 task');
  assert.equal(apiRequests.length, 0, 'Mock must not issue HTTP API requests');
  assert.deepEqual(errors, []);

  live = await server('live');
  const liveContext = await browser.newContext();
  const livePage = await liveContext.newPage(); const livePaths = [];
  await liveContext.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname; livePaths.push(path);
    const body = path.endsWith('/auth/refresh') ? { access_token: 'test-token' } : path.endsWith('/auth/me') ? { id: 'test-user', email: 'test@example.test', display_name: 'Test', timezone: 'Asia/Shanghai', created_at: new Date().toISOString() } : { error: { message: '测试中未启动P1后端' } };
    await route.fulfill({ status: path.includes('/auth/') ? 200 : 503, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await livePage.goto(live.base + '/practice'); await livePage.getByRole('heading', { name: '代码练习接口待接入' }).waitFor();
  assert.equal(livePaths.some(p => /practice|submission|review/.test(p)), false);
  await liveContext.close();
  log.push('Live renders unavailable boundary and issues no P2 API request (P1 auth intercepted only in this test)');
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ passed: log, errors, playwright: require(resolve('.preview/p2-browser/node_modules/playwright-core/package.json')).version }, null, 2));
  console.log(log.join('\n'));
} finally {
  await browser.close();
  for (const app of [mock, live]) if (app) { app.child.kill(); await new Promise(r => app.child.once('close', r)); }
}
