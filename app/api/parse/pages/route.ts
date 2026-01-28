import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const { storagePath } = await request.json();

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath가 필요합니다.' }, { status: 400 });
    }

    const normalized = typeof storagePath === 'string' && storagePath.startsWith('/')
      ? storagePath.slice(1)
      : storagePath;

    const pdfPath = join(process.cwd(), 'public', normalized);
    const scriptPath = join(process.cwd(), 'scripts', 'pdf_extract_pages.mjs');

    // Next 번들 환경에서 PDF 파서가 깨지는 문제를 피하기 위해,
    // 별도 Node 프로세스로 텍스트 추출 수행
    const { stdout } = await execFileAsync(
      process.execPath,
      [scriptPath, pdfPath],
      { maxBuffer: 50 * 1024 * 1024 } // 50MB
    );

    const parsed = JSON.parse(stdout);
    if (!parsed?.pages || !Array.isArray(parsed.pages)) {
      return NextResponse.json(
        { error: '페이지 텍스트 추출 결과가 유효하지 않습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      numPages: parsed.numPages,
      pages: parsed.pages,
    });
  } catch (error: any) {
    console.error('페이지 텍스트 추출 오류:', error);
    return NextResponse.json(
      { error: '페이지 텍스트 추출에 실패했습니다.', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}


