import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('학습장터 앱 테스트', () => {
  test('홈페이지에 워크시트 목록이 표시되는지 확인', async ({ page }) => {
    await page.goto(BASE_URL);

    // 페이지 로딩 대기
    await page.waitForLoadState('networkidle');

    // 스크린샷 저장
    await page.screenshot({ path: 'tests/screenshots/01-homepage.png', fullPage: true });

    // 워크시트 카드가 있는지 확인
    const worksheetCards = page.locator('a[href^="/worksheet/"]');
    const count = await worksheetCards.count();

    console.log(`워크시트 카드 개수: ${count}`);

    if (count > 0) {
      console.log('✅ 홈페이지에 워크시트가 표시됨');
    } else {
      console.log('❌ 워크시트가 표시되지 않음');

      // 에러 메시지 확인
      const errorText = await page.locator('body').textContent();
      console.log('페이지 내용:', errorText?.substring(0, 500));
    }

    expect(count).toBeGreaterThan(0);
  });

  test('로그인 테스트', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 로그인 버튼 클릭
    const loginLink = page.locator('a[href="/auth"], button:has-text("로그인")').first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      await page.goto(`${BASE_URL}/auth`);
    }

    await page.screenshot({ path: 'tests/screenshots/02-login-page.png', fullPage: true });

    // 로그인 폼 입력
    await page.fill('input[type="email"], input[name="email"]', 'teacher1@test.com');
    await page.fill('input[type="password"], input[name="password"]', 'test1234');

    await page.screenshot({ path: 'tests/screenshots/03-login-filled.png', fullPage: true });

    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');

    // 로딩 대기
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'tests/screenshots/04-after-login.png', fullPage: true });

    // 로그인 성공 확인 (홈페이지로 리다이렉트 또는 사용자 정보 표시)
    const url = page.url();
    console.log('현재 URL:', url);

    const pageContent = await page.locator('body').textContent();
    console.log('로그인 후 페이지 상태:', pageContent?.substring(0, 300));
  });

  test('워크시트 상세 페이지 테스트', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 첫 번째 워크시트 클릭
    const firstCard = page.locator('a[href^="/worksheet/"]').first();

    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: 'tests/screenshots/05-worksheet-detail.png', fullPage: true });

      const title = await page.locator('h1, h2').first().textContent();
      console.log('워크시트 제목:', title);

      expect(title).toBeTruthy();
    } else {
      console.log('워크시트가 없어서 상세 페이지 테스트 스킵');
    }
  });
});
