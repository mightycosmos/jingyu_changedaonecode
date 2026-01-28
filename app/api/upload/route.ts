import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: '파일이 없습니다.' },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 저장 디렉토리 설정
        const uploadDir = join(process.cwd(), 'public/uploads');

        // 디렉토리가 없으면 생성 (이미 run_command로 생성하긴 했지만 안전을 위해)
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e) {
            // ignore
        }

        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const path = join(uploadDir, fileName);

        await writeFile(path, buffer);
        console.log(`파일 저장 완료: ${path}`);

        const fileUrl = `/uploads/${fileName}`;

        return NextResponse.json({
            success: true,
            url: fileUrl,
            fileName: file.name,
            size: file.size,
            type: file.type,
        });
    } catch (error: any) {
        console.error('파일 업로드 오류:', error);
        return NextResponse.json(
            { error: '파일 업로드에 실패했습니다.', details: error.message },
            { status: 500 }
        );
    }
}
