import json

def find_sant_in_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    found = []
    for l in data.get('licences', []):
        for s in l.get('semestres', []):
            for u in s.get('ues', []):
                if 'sant' in u.get('nom', '').lower():
                    found.append(f"UE: {u.get('nom')}")
                for m in u.get('matieres', []):
                    if 'sant' in m.get('nom', '').lower():
                        found.append(f"Matiere: {m.get('nom')}")
    return found

print("In old:", find_sant_in_json('backups/espoir_cours_2026-07-09.json'))
print("In new:", find_sant_in_json('data/espoir_cours.json'))
