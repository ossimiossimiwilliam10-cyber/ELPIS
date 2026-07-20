#ifndef CERVEAU_COURS_H
#define CERVEAU_COURS_H

#include <string>
#include <vector>

// Structure représentant un unique CM et son statut dans la Méthode des J
struct CoursMagistral {
    std::string titre;
    int jActuel = 0; // 0 = nouveau (J0), 1 = J1, 3 = J3, etc.
    std::string derniereRevision = ""; // Format YYYY-MM-DD
    std::string fichePdfPath = ""; // Chemin web vers la fiche PDF
    std::string notes = ""; // Notes markdown
};

struct Exercice {
    std::string titre;
    int page = 1;
    std::string pdfSource = "";
    std::string dernierePratique = ""; // "YYYY-MM-DD"
    int nombrePratiques = 0;
    std::string notes = ""; // Notes markdown
    std::string difficulte = ""; // "" (pas noté), "tres_facile", "facile", "moyen", "assez_difficile", "difficile"
};

struct Matiere {
    std::string nom;
    int cm_h = 0; // Volume théorique total des CM
    int td_h = 0;
    int tp_h = 0;
    std::vector<CoursMagistral> listeCM; // Les CM spécifiques pour le suivi des J
    std::vector<Exercice> listeTD; // Scan automatique des exos TD
    std::vector<Exercice> listeTP; // Scan automatique des exos TP
};

struct UE {
    std::string nom;
    int ects = 0;
    std::vector<Matiere> matieres;
};

struct Semestre {
    std::string nom;
    std::vector<UE> ues;
};

struct Licence {
    std::string nom;
    std::vector<Semestre> semestres;
};

struct CoursConfig {
    std::vector<Licence> licences;
};

class CerveauCours {
private:
    std::string configFilePath;
    CoursConfig currentConfig;

    static void sanitize(CoursConfig& c);

public:
    explicit CerveauCours(const std::string& path);

    // Charge la configuration depuis le fichier JSON
    bool loadConfig();

    // Sauvegarde la configuration vers le fichier JSON de manière atomique
    bool saveConfig();

    const CoursConfig& getConfig() const;
    void setConfig(CoursConfig newConfig);
};

#endif // CERVEAU_COURS_H
