import PyPDF2

pdf_path = r"C:\Users\User\Desktop\Etudes\Mes cours 2026 - 2027\L2 Sciences pour l'ingénieur - Semestre 3\MCC L2 Sciences pour l'ingénieur et santé.pdf"

try:
    with open(pdf_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        text = ""
        # Pages 4 to 9 (0-indexed: 3 to 8)
        for i in range(3, min(9, len(reader.pages))):
            text += f"--- PAGE {i+1} ---\n"
            text += reader.pages[i].extract_text() + "\n"
        
        with open("mcc_pages_5_9.txt", "w", encoding="utf-8") as out:
            out.write(text)
        print("Pages extraites dans mcc_pages_5_9.txt")
except Exception as e:
    print(f"Erreur: {e}")
