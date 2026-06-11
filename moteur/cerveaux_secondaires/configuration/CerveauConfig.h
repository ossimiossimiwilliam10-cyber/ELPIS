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
    std::string studyStartDate;
    std::string bedtime;
    std::string wakeUpTime;
    int maxStudyHoursPerDay;
    float targetGrade; // Moyenne visée (ex: 17.0)
    int summerStudyHoursCompleted; // Heures déjà travaillées pendant l'été

    // Moteur d'apprentissage
    int maxSubjectsPerDay;
    int studyBlockDurationMinutes;
    int activeRecallMinutesPerDay;

    // Listes des matières et engagements
    std::vector<Subject> subjects;
    std::vector<FixedCommitment> fixedCommitments;

    // Interface
    std::string theme; // "dark" ou "light"
};

// La classe qui représente le Cerveau Configuration
class CerveauConfig {
private:
    AppConfig currentConfig;
    std::string configFilePath;

public:
    // Constructeur : on lui donne le nom du fichier où sauvegarder les paramètres
    CerveauConfig(const std::string& path = "espoir_config.json");
    
    // Charge les paramètres depuis le fichier (retourne true si succès)
    bool loadConfig();
    
    // Sauvegarde les paramètres dans le fichier (retourne true si succès)
    bool saveConfig();
    
    // Permet de lire et modifier la configuration en mémoire
    AppConfig& getConfig();
    void setConfig(const AppConfig& newConfig);
};

#endif // CERVEAU_CONFIG_H
