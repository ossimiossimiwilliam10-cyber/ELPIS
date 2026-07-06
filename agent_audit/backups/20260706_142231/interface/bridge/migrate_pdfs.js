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

    console.log("✅ Connecté à MongoDB.");
    
    if (!fs.existsSync(DOCUMENTS_DIR)) {
      console.log("Aucun dossier 'documents' trouvé localement.");
      return;
    }

    const files = fs.readdirSync(DOCUMENTS_DIR);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      console.log("Aucun fichier PDF local à migrer.");
      return;
    }

    console.log(`📤 ${pdfFiles.length} fichier(s) trouvé(s). Début de la migration...`);

    for (const filename of pdfFiles) {
      const filePath = path.join(DOCUMENTS_DIR, filename);
      const existing = await bucket.find({ filename }).toArray();
      if (existing.length > 0) {
        console.log(`- ${filename} est déjà dans GridFS, ignoré.`);
        continue;
      }

      console.log(`- Upload de ${filename}...`);
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: 'application/pdf'
      });
      
      const fileStream = fs.createReadStream(filePath);
      await new Promise((resolve, reject) => {
        fileStream.pipe(uploadStream)
          .on('error', reject)
          .on('finish', resolve);
      });
      console.log(`  ✓ Succès: ${filename}`);
    }

    console.log("🎉 Tous les PDFs ont été migrés avec succès !");
  } catch (err) {
    console.error("❌ Erreur pendant la migration :", err);
  } finally {
    await client.close();
  }
}

migratePDFs();
