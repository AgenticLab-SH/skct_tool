# SKCT Tool legacy redirect

예전 GitHub Pages 주소의 방문자를 `https://skct.agenticfabworks.com/`으로 보내는 최소 리디렉트 저장소입니다. 기존 기본 경로는 `/skct_tool`이며, 뒤의 경로·쿼리·해시는 새 주소에도 유지합니다.

이 저장소에는 실제 서비스 소스, 인증 정보, 사용자 데이터가 없습니다. 검색 결과 중복을 막기 위해 HTML은 `noindex, nofollow`, `robots.txt`는 전체 수집 금지를 사용합니다.

## 검증

```powershell
node scripts/check-redirect.mjs https://skct.agenticfabworks.com/ /skct_tool
```

`.github/workflows/quality.yml`도 push와 pull request에서 같은 검사를 실행합니다. Pages 공개 여부는 별도의 GitHub 저장소 설정입니다. 배포 워크플로가 존재해도 Pages가 자동으로 활성화되지는 않습니다.
