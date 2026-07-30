import pathlib
p = pathlib.Path('docs/FAQ.md')
t = p.read_text('utf-8')
reps = [
    ('Derniere mise a jour', 'Derni\u00e8re mise \u00e0 jour'),
    ('reponse', 'r\u00e9ponse'),
    ('matiere', 'mati\u00e8re'),
    ('a cote', '\u00e0 c\u00f4t\u00e9'),
    ('etat', '\u00e9tat'),
    ('systeme', 'syst\u00e8me'),
    ('deja', 'd\u00e9j\u00e0'),
    ('verifie', 'v\u00e9rifie'),
    ('genere', 'g\u00e9n\u00e8re'),
    ('cochee', 'coch\u00e9e'),
    ('gere', 'g\u00e8re'),
    ('donnees', 'donn\u00e9es'),
    ('parametres', 'param\u00e8tres'),
    ('desactivee', 'd\u00e9sactiv\u00e9e'),
    ('definie', 'd\u00e9finie'),
    ('ecran', '\u00e9cran'),
    ('etudie', '\u00e9tudi\u00e9'),
    ('demarre', 'd\u00e9marre'),
    ('redemarre', 'red\u00e9marre'),
    ('tache', 't\u00e2che'),
    ('modele', 'mod\u00e8le'),
    ('probleme', 'probl\u00e8me'),
    ('difference', 'diff\u00e9rence'),
    ('methode', 'm\u00e9thode'),
    ('tres', 'tr\u00e8s'),
    ('cree', 'cr\u00e9e'),
    ('installe', 'install\u00e9'),
    ('tete', 't\u00eate'),
    ('dependance', 'd\u00e9pendance'),
    ('manquante', 'manquante'),
    ('probleme', 'probl\u00e8me'),
    ('prevu', 'pr\u00e9vu'),
    ('apres', 'apr\u00e8s'),
    ('grace', 'gr\u00e2ce'),
    ('tres', 'tr\u00e8s'),
    ('ou', 'o\u00f9'),
    ('gere', 'g\u00e8re'),
]
for old, new in reps:
    t = t.replace(old, new)
p.write_text(t, 'utf-8')
print('OK')
