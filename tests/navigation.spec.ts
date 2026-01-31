import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('네비게이션 무한 로딩 테스트', () => {
  test('홈페이지 → 상세 → 홈페이지 반복 테스트', async ({ page }) => {
    // 1. 홈페이지 로드
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 워크시트가 로드될 때까지 대기 (최대 10초)
    await page.waitForSelector('a[href^="/worksheet/"]', { timeout: 10000 });

    let worksheetCount = await page.locator('a[href^="/worksheet/"]').count();
    console.log(`1차 홈페이지: ${worksheetCount}개 워크시트 표시`);
    expect(worksheetCount).toBeGreaterThan(0);

    // 2. 첫 번째 워크시트 클릭
    await page.locator('a[href^="/worksheet/"]').first().click();
    await page.waitForLoadState('networkidle');
    console.log('워크시트 상세 페이지 이동 완료');

    // 3. 홈 버튼 또는 로고 클릭해서 홈으로 이동
    await page.click('a[href="/"]');
    await page.waitForLoadState('networkidle');

    // 워크시트가 다시 로드될 때까지 대기
    await page.waitForSelector('a[href^="/worksheet/"]', { timeout: 10000 });

    worksheetCount = await page.locator('a[href^="/worksheet/"]').count();
    console.log(`2차 홈페이지: ${worksheetCount}개 워크시트 표시`);
    expect(worksheetCount).toBeGreaterThan(0);

    // 스크린샷 저장
    await page.screenshot({ path: 'tests/screenshots/navigation-test.png', fullPage: true });

    // 4. 다시 상세 페이지로 이동
    await page.locator('a[href^="/worksheet/"]').first().click();
    await page.waitForLoadState('networkidle');
    console.log('2차 워크시트 상세 페이지 이동 완료');

    // 5. 다시 홈으로
    await page.click('a[href="/"]');
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('a[href^="/worksheet/"]', { timeout: 10000 });

    worksheetCount = await page.locator('a[href^="/worksheet/"]').count();
    console.log(`3차 홈페이지: ${worksheetCount}개 워크시트 표시`);
    expect(worksheetCount).toBeGreaterThan(0);

    console.log('✅ 네비게이션 무한 로딩 테스트 통과!');
  });

  test('필터 변경 후 홈 이동 테스트', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 워크시트 로드 대기
    await page.waitForSelector('a[href^="/worksheet/"]', { timeout: 10000 });

    // 정렬 변경
    const sortSelect = page.locator('select').last();
    if (await sortSelect.isVisible()) {
      await sortSelect.selectOption('popular');
      await page.waitForTimeout(1000);
    }

    // 워크시트 클릭
    await page.locator('a[href^="/worksheet/"]').first().click();
    await page.waitForLoadState('networkidle');

    // 홈으로 돌아가기
    await page.click('a[href="/"]');
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('a[href^="/worksheet/"]', { timeout: 10000 });

    const worksheetCount = await page.locator('a[href^="/worksheet/"]').count();
    console.log(`필터 테스트 후 홈페이지: ${worksheetCount}개 워크시트 표시`);
    expect(worksheetCount).toBeGreaterThan(0);

    console.log('✅ 필터 변경 후 홈 이동 테스트 통과!');
  });
});
