const fs = require('fs');
const https = require('https');
const path = require('path');

const downloadImage = (url, filename) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filename);
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };
        https.get(url, options, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: Status Code ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded: ${filename}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filename, () => { });
            reject(err);
        });
    });
};

const downloadAll = async () => {
    const targetDir = path.join(__dirname, 'event-management-backend', 'assets', 'sdgs');
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Download SDG 1 to 17
    for (let i = 1; i <= 17; i++) {
        const url = `https://open-sdg.github.io/sdg-translations/assets/img/goals/en/${i}.png`;
        const filename = path.join(targetDir, `SDG${i}.png`);
        try {
            await downloadImage(url, filename);
        } catch (error) {
            console.error(`Error downloading SDG${i}:`, error.message);
        }
    }
};

downloadAll();
