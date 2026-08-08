# 260807

지금 라즈베리파이에 nautilus 서버가 있다.

한달에 한번 정도 자꾸 꺼지고 안댔다. 4gb sd카드 쓸때는 그래도 안그랫던거같은데 32gb 새거로 바꾼 다음부터. 근데 4gb쓸때도 초반에는 ㄱ랬던거 보면..흠..걍 모르겠다.

뭔가 이상한지 어떤 날에는 공유기 가까이로 가도 죽어도 안되고 어떤 날에는 문닫아도 잘만 됐다.

열 문제도 전원 문제도 아닌 거 확인했다.
신호가 느리고 타임아웃도 조금씩 나다가 그다음부턴 걍 안됐다. network-config로 와이파이를 2.4g, 내폰 핫스팟으로 바꿔봤지만 다 안됐다. 이상한게 맥북에서 pi로 핑은 겁나 느린데 pi에서 공유기까지는 빨랐다.

그래서 그냥 하드웨어 문제가 아닐까 한다.
일단 라즈베리파이는 냅두고 nautilus를 오라클 클라우드로 옮기기로 했다.
- 저번에 오라클 키가 뭐 잘못돼서 ssh가 안됐었는데 새 키 발급해서 인스턴스 다시 만들었음.

`ssh -i ~/.ssh/oracle_free ubuntu@168.110.99.192`

라즈베리파이가 안켜지니까 sd카드를 맥북에 연결했다.
이게 리눅스 파일시스템이라 맥에서 못본다고한다. 
그래서 utm을 깔았더니 옛날에 만들어놓은 우분투 데스크탑 깔린 가상머신이 있었다. 그걸로들어갔다.
usb sharing 설정을 켜니까 맥에 꽂은 sd카드가 리눅스 가상머신에서 보였다.

`lsblk`로 연결된 sd카드 이름을 본다.

마운트인지 뭔지를했다
`sudo mkdir -p /mnt/pi`
`sudo mount /dev/sda2 /mnt/pi`

그러고나서 `mnt/pi`를 열었다.
뭔가잘못돼서 이름이 `sdb`가돼서 그걸로 다시 마운트함
그래서 가상머신으로 /srv, /etc/nginx 따위를 복사하려는데 가상머신 디스크가 부족함

그래서 오라클로 바로 옮기려는데 키가 없어서 안됨. 그래서 맥의 키를 utm으로 복사함
`scp ~/.ssh/oracle_free solmi@192.168.64.5:~`
utm ip: 192.168.64.5. ip아는법: `ip addr`


그다음에 오라클로 복사함
`scp -i ~/oracle_free -r /mnt/pi/srv ubuntu@168.110.99.192:~`
`scp -i ~/oracle_free -r /mnt/pi/etc/nginx ubuntu@168.110.99.192:~`
`scp -i ~/oracle_free -r /mnt/pi/etc/systemd ubuntu@168.110.99.192:~`

그리고 제자리로 돌려보냄.
dns content를 오라클 public ip로 바꿔놓았는데 안되길래

방화벽 80 443 설정함.


sudo apt install nginx
sudo apt install git
sudo apt install nodejs npm
sudo dpkg --configure -a
sudo apt remove nodejs npm
sudo apt autoremove

sudo systemctl daemon-reload
sudo systemctl enable nautilus
sudo systemctl start nautilus

sudo nginx -t
sudo systemctl restart nginx