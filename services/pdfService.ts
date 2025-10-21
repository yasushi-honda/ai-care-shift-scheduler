
import type { StaffSchedule } from '../types';
import { WEEKDAYS } from '../constants';

// Define the jsPDF class for TypeScript, including the optional autoTable method
// that the jspdf-autotable plugin is expected to add to the prototype.
declare class jsPDF {
  constructor(options?: any);
  setFont(fontName: string, fontStyle?: string): this;
  setFontSize(size: number): this;
  text(text: string, x: number, y: number, options?: any): this;
  setFillColor(r: number, g: number, b: number): this;
  rect(x: number, y: number, w: number, h: number, style?: string): this;
  setTextColor(r: number, g: number, b: number): this;
  save(filename: string): void;
  autoTable?: (options: any) => this;
  static API: any;
}

// Create a type alias for the jsPDF constructor.
type jsPDFConstructor = typeof jsPDF;

// Define the shape of the global jspdf object loaded from its CDN.
declare global {
  interface Window {
    jspdf: {
      jsPDF: jsPDFConstructor;
    };
  }
}

// Use single, reliable CDN sources for simplicity and to aim for "minimal success".
const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const AUTOTABLE_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
// Use multiple CDN sources for the font as fallbacks to increase reliability.
const FONT_URLS = [
    'https://unpkg.com/notosans-jp-webfont@2.0.0/regular/NotoSansJP-Regular.ttf',
    'https://cdn.jsdelivr.net/npm/notosans-jp-webfont@2.0.0/regular/NotoSansJP-Regular.ttf',
    'https://raw.githack.com/minoryorg/notosans-jp-webfont/master/regular/NotoSansJP-Regular.ttf' // Fallback via a different CDN infrastructure
];

const loadedScripts = new Map<string, Promise<void>>();

const loadScript = (url: string): Promise<void> => {
    if (loadedScripts.has(url)) {
        return loadedScripts.get(url)!;
    }
    const promise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = () => {
            resolve();
        };
        script.onerror = () => {
            console.error(`Failed to load script: ${url}`);
            reject(new Error(`スクリプトの読み込みに失敗しました: ${url}`));
        };
        document.head.appendChild(script);
    });
    loadedScripts.set(url, promise);
    return promise;
};

// Singleton promise to ensure initialization happens only once.
let jsPdfPromise: Promise<jsPDFConstructor> | null = null;

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

const fetchWithFallbacks = async (urls: string[]): Promise<ArrayBuffer> => {
    let lastError: Error | undefined;
    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return response.arrayBuffer();
            }
            console.warn(`Failed to fetch from ${url}, status: ${response.status}`);
            lastError = new Error(`Server responded with status ${response.status}`);
        } catch (error) {
            console.warn(`Network error fetching from ${url}`, error);
            if (error instanceof Error) {
                lastError = error;
            } else {
                lastError = new Error(String(error));
            }
        }
    }
    throw new Error(`リソースの読み込みに全てのCDNソースから失敗しました。: ${lastError?.message || 'Unknown fetch error'}`);
}


const getInitializedJsPdf = (): Promise<jsPDFConstructor> => {
  if (!jsPdfPromise) {
    jsPdfPromise = (async () => {
      try {
        // Load jsPDF and its autotable plugin
        await loadScript(JSPDF_URL);
        await loadScript(AUTOTABLE_URL);
        
        const jsPDFConstructor = window.jspdf?.jsPDF;
        if (typeof jsPDFConstructor !== 'function') {
          throw new Error('PDFライブラリ(jsPDF)の読み込みに失敗しました。');
        }
        const testDoc = new jsPDFConstructor();
        if (typeof testDoc.autoTable !== 'function') {
          throw new Error('PDFテーブルプラグイン(jspdf-autotable)の読み込みに失敗しました。');
        }
        
        // Fetch the font from a CDN with fallbacks, convert to base64, and register it.
        const fontArrayBuffer = await fetchWithFallbacks(FONT_URLS);
        const fontBase64 = arrayBufferToBase64(fontArrayBuffer);

        jsPDFConstructor.API.addFileToVFS('NotoSansJP-Regular.ttf', fontBase64);
        jsPDFConstructor.API.addFont('NotoSansJP-Regular.ttf', 'notosansjp', 'normal');

        return jsPDFConstructor;
      } catch (error) {
        // On failure, reset the promise to allow retrying.
        jsPdfPromise = null; 
        throw error;
      }
    })();
  }
  return jsPdfPromise;
};


const getShiftFillColor = (shiftType: string): [number, number, number] | null => {
  switch (shiftType) {
    case '早番': return [224, 242, 254]; // bg-sky-100
    case '日勤': return [209, 250, 229]; // bg-emerald-100
    case '遅番': return [254, 243, 199]; // bg-amber-100
    case '夜勤': return [224, 231, 255]; // bg-indigo-100
    case '休': return [241, 245, 249]; // bg-slate-100
    case '明け休み': return [226, 232, 240]; // bg-slate-200
    default: return null;
  }
};

export const exportToPDF = async (schedule: StaffSchedule[], targetMonth: string) => {
  try {
    const jsPDFConstructor = await getInitializedJsPdf();
    const doc = new jsPDFConstructor({ orientation: 'landscape' });
    
    doc.setFont('notosansjp');

    const [year, month] = targetMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const title = `${year}年 ${month}月 シフト表`;
    doc.setFontSize(18);
    doc.text(title, 14, 16);

    const head: (string | number)[][] = [['スタッフ名']];
    const dates: string[] = [];
    const weekdays: string[] = [];

    for (let i = 1; i <= daysInMonth; i++) {
      head[0].push(String(i));
      dates.push(`${targetMonth}-${String(i).padStart(2, '0')}`);
      const date = new Date(year, month - 1, i);
      weekdays.push(WEEKDAYS[date.getDay()]);
    }
    head.push([''].concat(weekdays));

    const body = schedule.map(staffSchedule => {
      const shiftMap = new Map(staffSchedule.monthlyShifts.map(s => [s.date, s.shiftType]));
      const row = [staffSchedule.staffName];
      dates.forEach(date => {
        row.push(shiftMap.get(date) || '');
      });
      return row;
    });

    if (!doc.autoTable) {
      // This should not be reached due to the check in getInitializedJsPdf,
      // but serves as a final safeguard.
      throw new Error('PDFテーブル作成機能が利用できません。');
    }

    doc.autoTable({
      head: head,
      body: body,
      startY: 22,
      theme: 'grid',
      styles: {
        font: 'notosansjp',
        fontSize: 6.5,
        cellPadding: 1.5,
        halign: 'center',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: [203, 213, 225],
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', minCellWidth: 25 },
      },
      didParseCell: (data: any) => {
        if (data.section === 'head' && data.row.index === 1) {
            if (data.cell.text[0] === '土' || data.cell.text[0] === '日') {
                data.cell.styles.textColor = [219, 39, 119];
            }
        }
      },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 0) {
          const text = data.cell.raw as string;
          const fillColor = getShiftFillColor(text);
          if (fillColor) {
            doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            
            let textColor: [number, number, number] | undefined;
             switch (text) {
                case '早番': textColor = [14, 116, 144]; break;
                case '日勤': textColor = [6, 95, 70]; break;
                case '遅番': textColor = [146, 64, 14]; break;
                case '夜勤': textColor = [55, 48, 163]; break;
                case '休': textColor = [71, 85, 105]; break;
                case '明け休み': textColor = [51, 65, 85]; break;
              }
            
            if(textColor) {
              doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            }

            doc.text(data.cell.text, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, {
                halign: 'center',
                valign: 'middle',
            });
            doc.setTextColor(30, 41, 59);
          }
        }
      },
    });

    doc.save(`shift_${targetMonth.replace('-', '')}.pdf`);
  } catch(error) {
    console.error("PDFエクスポート処理中にエラーが発生しました:", error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました。';
    alert(`PDFのエクスポートに失敗しました。\n\nエラー: ${errorMessage}\n\nネットワーク接続を確認し、ページを再読み込みしてからもう一度お試しください。`);
  }
};
