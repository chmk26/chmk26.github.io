---
title: Ubuntu 26.04 초기 세팅
summary: 필수 프로그램 및 한글 설정
date: 2026-08-30
tags:
  - ubuntu
  - installation
---
# 필수 프로그램들 설치
개개인마다 필수 프로그램들은 다를테니, 개인적으로 항상 설치하는 넷만 기록하겠다.

## 1. Terminator
- 기본적으로 Ubuntu에도 Terminal이 설치되어 있으나, 아마 대부분은 이 Terminator를 설치할 것이다.
- 화면 분할, 단축키 등 기본 Terminal에서 제공하는 기능보다 많은 기능이 있다.

## 2. VSCode
- 프로그래밍을 많이 하는 입장에서 VSCode도 대부분이 설치하는 프로그램이다.
- 사용방법은 뭐..

## 3. Chrome
- FireFox가 기본으로 설치되어 있긴 하지만, Chrome을 포기하기는 쉽지 않다.
- Nvidia의 Jetson을 이용한다면 Chrome은 설치할 수 없다. (Chromium이나 FireFox를 사용함..) 하지만 설치할 수 있다면 무조건 설치하는 편.

## 4. Obsidian
- 옵시디언은 개인적인 취향에 따른 픽이다.
- 보통 Notion을 많이 쓰지만, 클라우드 서버 기반이라 느리고 무겁다는 단점이 있다. 옵시디언은 로컬 md 파일 기반이기 때문에 오프라인에서도 동작하고 빠르다.
- 메모나 정리를 많이 하는 입장에서 이만한 프로그램이 없다고 생각한다.
- 사실 Ubuntu에서는 처음 사용해보는데, 한번 시도해볼까 한다.

---
## 한글 설정
아무래도 영어를 많이 쓰기는 하겠으나 한글 없이 불편한 점도 많다. 따라서 한글 설정은 해두는게 편하다. 설치 방법은 1가지가 아닌 것으로 알고 있다. 그 중 이번에 시도한 방법만 기록하고자 한다.

### 1. 패키지 설치
```
sudo apt update
sudo apt install ibus-hangul
```

### 2. Ubuntu System 설정
(1) ``Settings`` > ``Region & Language`` 진입
(2) ``Manage Installed Languages`` 클릭
(3) ``Install`` 할것들 Install
(4) ``Install / Remove Languages...`` 클릭
(5) ``Korean`` 체크 후 ``Apply``

### 3. Keyboard 설정
(1) ``Settings`` > ``Keyboard`` 진입
(2) 현재 ``English (US)``만 존재하는데, Add 눌러 ``Korean (Hangul)`` 추가
(3) 만약 안보인다면, ``ibus-restart`` 해주고, Account에서 Logout 후 다시 Login 시도
(4) 추가 후 ``Korean (Hangul)``에서 ``Keyboard Settings`` 에 진입 해 Toggle 키 설정
(5) ``Hangul Toggle Key`` 부분에 기존건 Remove 해주고, Add를 누른 뒤 ``한/영`` 키 누르고 Apply, Ok.
(6) 이제 ``한/영`` 키로 한글, 영어 키로 변경 가능하다.

