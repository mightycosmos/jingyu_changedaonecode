import { readFile } from 'fs/promises';

/**
 * PDF 파일에서 특정 페이지의 텍스트를 추출합니다.
 * pdfjs-dist 대신 pdf-parse를 사용하여 서버 사이드에서 더 안정적으로 동작하게 합니다.
 */
export async function extractTextFromPdfPage(pdfPath: string, pageNumber: number): Promise<string> {
    try {
        const pdfParse = await import('pdf-parse');
        const dataBuffer = await readFile(pdfPath);
        
        // pdf-parse는 기본적으로 전체 텍스트를 추출하지만, 
        // max 옵션을 사용하여 특정 페이지까지만 추출하거나 
        // pagerender를 커스텀하여 특정 페이지만 가져올 수 있습니다.
        
        let currentPage = 0;
        let pageText = '';
        
        const options = {
            pagerender: function(pageData: any) {
                currentPage++;
                if (currentPage === pageNumber) {
                    return pageData.getTextContent()
                        .then(function(textContent: any) {
                            let lastY, text = '';
                            for (let item of textContent.items) {
                                if (lastY == item.transform[5] || !lastY){
                                    text += item.str;
                                }  
                                else{
                                    text += '\n' + item.str;
                                }    
                                lastY = item.transform[5];
                            }
                            pageText = text;
                            return text;
                        });
                }
                return '';
            }
        };

        // pdf-parse는 CommonJS에서는 함수로, ESM에서는 PDFParse로 export됨
        const parseFn = (pdfParse as any).default || pdfParse.PDFParse || pdfParse;
        await parseFn(dataBuffer, options);
        return pageText;
    } catch (error: any) {
        console.error('PDF 텍스트 추출 중 오류 (pdf-parse):', error);
        throw error;
    }
}

/**
 * PDF 파일의 전체 페이지 수를 반환합니다.
 */
export async function getPageCount(pdfPath: string): Promise<number> {
    try {
        const pdfParse = await import('pdf-parse');
        const dataBuffer = await readFile(pdfPath);
        // pdf-parse는 CommonJS에서는 함수로, ESM에서는 PDFParse로 export됨
        const parseFn = (pdfParse as any).default || pdfParse.PDFParse || pdfParse;
        const data = await parseFn(dataBuffer);
        return data.numpages;
    } catch (error: any) {
        console.error('PDF 페이지 수 조회 중 오류 (pdf-parse):', error);
        throw error;
    }
}
