#ifndef CERVEAU_CONFIG_H
#define CERVEAU_CONFIG_H

#include <string>
#include <vector>

// Représente une matière et ses multiples dates d'examens (suite à votre excellente remarque)
struct Subject {
    std::string name;
    std::string color;
    std::vector<std::string> examDates; // Ex: {"15-11-2026", "20-01-2027"}
};

// Représente un cours ou engagement fixe (ex: CM de Physique le Lundi de 8h à 10h)
struct FixedCommitment {
    std::string title;
    std::string dayOfWeek;
    std::string startTime;
    std::string endTime;
};

// Contient l'intégralité des paramètres de notre application
struct AppConfig {
    // Paramètres personnels et Horaires
    std::string studyStartDate = "07-09-2026";
    std::string bedtime = "23:00";
    std::string wakeUpTime = "07:00";
    int maxStudyHoursPerDay = 8;
    float targetGrade = 14.0f; // Moyenne visée (ex: 17.0)
    int summerStudyHoursCompleted = 0; // Heures déjà travaillées pendant l'été

    // Moteur d'apprentissage
    int maxSubjectsPerDay = 3;
    int studyBlockDurationMinutes = 50;
    int activeRecallMinutesPerDay = 30;

    // Listes des matières et engagements
    std::vector<Subject> subjects;
    std::vector<FixedCommitment> fixedCommitments;

    // Interface
    std::string theme = "dark"; // "dark" ou "light"
};

// La classe qui représente le Cerveau Configuration
class CerveauConfig {
private:
    AppConfig currentConfig;
    std::string configFilePath;

public:
    // Constructeur : on lui donne le nom du fichier où sauvegarder les paramètres
    explicit CerveauConfig(const std::string& path = "espoir_config.json");
    
    // Charge les paramètres depuis le fichier (retourne true si succès)
    bool loadConfig();
    
    // Sauvegarde les paramètres dans le fichier (retourne true si succès)
    bool saveConfig();
    
    // Accès en lecture seule à la configuration
    const AppConfig& getConfig() const;
    
    // Seule méthode autorisée pour modifier la configuration
    void setConfig(AppConfig newConfig);

private:
    // Nettoyage et validation des données (bornes, formats)
    static void sanitize(AppConfig& c);
};

#endif // CERVEAU_CONFIG_H
