const fs = require('fs');
const path = require('path');
const { MongoClient, GridFSBucket } = require('mongodb');
require('dotenv').config();

const DOCUMENTS_DIR = path.join(__dirname, '..', '..', 'documents');

async function migratePDFs() {
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI manquant dans .env. Opération annulée.");
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('elpis_db');
    const bucket = new GridFSBucket(db, { bucketName: 'documents' });

    
    if (!fs.existsSync(DOCUMENTS_DIR)) {
      return;
    }

    const files = fs.readdirSync(DOCUMENTS_DIR);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      return;
    }


    for (const filename of pdfFiles) {
      const filePath = path.join(DOCUMENTS_DIR, filename);
      const existing = await bucket.find({ filename }).toArray();
      if (existing.length > 0) {
        continue;
      }

      const uploadStream = bucket.openUploadStream(filename, {
        contentType: 'application/pdf'
      });
      
      const fileStream = fs.createReadStream(filePath);
      await new Promise((resolve, reject) => {
        fileStream.pipe(uploadStream)
          .on('error', reject)
          .on('finish', resolve);
      });
    }

  } catch (err) {
    console.error("❌ Erreur pendant la migration :", err);
  } finally {
    await client.close();
  }
}

migratePDFs();
