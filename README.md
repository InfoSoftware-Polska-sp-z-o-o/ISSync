Wyłączenie Hyper-V (problem z virtualbox https://forums.virtualbox.org/viewtopic.php?f=25&t=99390)

w cmd jako Admin

```sh
bcdedit /set hypervisorlaunchtype off
DISM /Online /Disable-Feature:Microsoft-Hyper-V
```

Zmiana zdjec i ekranu dolaczania:

```sh
docker cp BBB_WWW/images/  id-kontenera:/var/www/bigbluebutton-default
docker cp BBB_WWW/index.html  id-kontenera:/var/www/bigbluebutton-default
```

Uruchomienie Projektu

```sh
sudo docker container start  6 idkontynera
~/.bbb/bbb-dev-01.sh
sudo bbb-conf --restart

sudo systemctl stop bbb-html5 mongod
cd ~/src/bigbluebutton-html5/
npm install
npm start

sudo bbb-conf --status sprawdzanie 
sudo bbb-conf --start



bbb-dev-01.test
```

Dane 



katalog z projektem bbb-dev-01

https://bbb-dev-01.test/
```

