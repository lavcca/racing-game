import { test, expect } from '@playwright/test';

for (const circuit of ['네온 시티 서킷', '듄 스프린트']) {
  test(`${circuit}: render, drive, pause, recover, restart`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.circuit-card')).toHaveCount(2);
    await page.getByRole('button', { name: new RegExp(circuit) }).click();
    await expect(page.locator('#game-canvas')).toBeVisible();
    await expect(page.locator('.race-banner')).toHaveText('', {timeout:30000});
    await page.keyboard.down('ArrowUp');
    await expect.poll(async () => Number((await page.locator('.race-hud').innerText()).match(/속도:\s*(\d+)/)?.[1] ?? 0), {timeout:15000}).toBeGreaterThan(0);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.press('KeyP');
    await expect(page.locator('.race-banner')).toHaveText('일시정지');
    const paused = await page.locator('.race-hud').innerText();
    await page.waitForTimeout(300);
    expect(await page.locator('.race-hud').innerText()).toBe(paused);
    await page.getByRole('button', {name:'계속하기'}).click();
    await page.keyboard.press('KeyR');
    await expect(page.locator('.race-hud')).toContainText('속도: 0 km/h');
    await page.screenshot({path:`test-results/${circuit}.png`});
    await page.getByRole('button', {name:'트랙 선택',exact:true}).click();
    await expect(page.locator('.circuit-card')).toHaveCount(2);
    expect(errors).toEqual([]);
  });
}

test('touch controls accelerate and release on mobile', async ({browser}) => {
  const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:0.5,hasTouch:true,isMobile:true});
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173');
  await page.locator('.circuit-card').first().click();
  await expect(page.locator('.race-banner')).toHaveText('', {timeout:30000});
  const throttle=page.getByRole('button',{name:'가속',exact:true});
  await expect(throttle).toBeVisible();
  const bounds = (await throttle.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}]});
  const speed = async () => Number((await page.locator('.race-hud').innerText()).match(/속도:\s*(\d+)/)?.[1] ?? 0);
  await expect.poll(speed, {timeout:15000}).toBeGreaterThan(5);
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  const released = await speed();
  await expect.poll(speed, {timeout:15000}).toBeLessThan(released);
  await page.screenshot({path:'test-results/mobile.png'});
  await context.close();
});

test('driving off the circuit shows warning and slows down under throttle', async ({page}) => {
  await page.goto('/');
  await page.screenshot({path:'test-results/expanded-circuits.png'});
  await page.locator('.circuit-card').first().click();
  await expect(page.locator('.race-banner')).toHaveText('', {timeout:30000});
  await page.keyboard.down('ArrowUp');
  const speed = async () => Number((await page.locator('.race-hud').innerText()).match(/속도:\s*(\d+)/)?.[1] ?? 0);
  await expect.poll(speed, {timeout:30000}).toBeGreaterThan(80);
  await page.keyboard.down('ArrowLeft');
  await expect(page.locator('.race-banner')).toContainText('트랙 이탈', {timeout:30000});
  await page.keyboard.up('ArrowLeft');
  await expect.poll(speed, {timeout:15000}).toBeLessThan(22);
  await expect(page.locator('.race-banner')).toContainText('트랙 이탈');
  await page.screenshot({path:'test-results/off-road.png'});
  await page.keyboard.up('ArrowUp');
});
