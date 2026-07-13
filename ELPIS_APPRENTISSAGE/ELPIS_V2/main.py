import sys 
from PyQt6.QtWidgets import QApplication, QWidget 
app = QApplication(sys.argv)
fenetre = QWidget() 
fenetre.show() 
fenetre.setWindowTitle("Bonjour")
app.exec() 
