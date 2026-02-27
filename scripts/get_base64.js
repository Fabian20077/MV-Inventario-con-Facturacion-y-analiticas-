
import fs from 'fs';
import path from 'path';

const imagePath = String.raw`C:\Users\USUARIO\.gemini\antigravity\brain\88b5a1cb-32ee-48c4-ae7d-0885d7f2432a\uploaded_media_0_1770070834653.jpg`;

try {
    const bitmap = fs.readFileSync(imagePath);
    const base64 = Buffer.from(bitmap).toString('base64');
    console.log(base64);
} catch (e) {
    console.error(e);
}
