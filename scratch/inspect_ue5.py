import json

def inspect_ue5(file_path):
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        data = json.load(f)
    for l in data.get('licences', []):
        for s in l.get('semestres', []):
            for u in s.get('ues', []):
                if 'ue 5' in u.get('nom', '').lower():
                    print("Licence:", l.get('nom'), "| archived:", l.get('archived', False))
                    print("Semestre:", s.get('nom'), "| archived:", s.get('archived', False), "| dateFin:", s.get('dateFin'))
                    print("UE:", u.get('nom'))

inspect_ue5('data/espoir_cours.json')
