cmake_minimum_required(VERSION 3.10)
project(ELPIS_Moteur)

set(CMAKE_CXX_STANDARD 17)

# Utilisation statique pour eviter le probleme de DLL sur Windows
set(CMAKE_EXE_LINKER_FLAGS "-static")

add_executable(moteur_config
    moteur/moteur_menu_configuration/CerveauConfig.cpp 
    moteur/moteur_menu_configuration/main_config.cpp
)
target_include_directories(moteur_config PRIVATE lib)

# Cible pour le Cerveau Cours
add_executable(moteur_cours
    moteur/moteur_menu_cours/main_cours.cpp
    moteur/moteur_menu_cours/CerveauCours.cpp
)
target_include_directories(moteur_cours PRIVATE lib)

# Cible pour le Cerveau Principal (Orchestrateur)
add_executable(moteur_principal
    moteur/moteur_menu_principal/main_principal.cpp
    moteur/moteur_menu_principal/CerveauPrincipal.cpp
)
target_include_directories(moteur_principal PRIVATE lib)
