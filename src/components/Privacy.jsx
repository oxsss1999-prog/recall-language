/*
 * Privacy policy (개인정보처리방침).
 * Before going public: set CONTACT to an email you check, and review the text.
 */
const CONTACT = 'recall.help@example.com'; // TODO: replace with your contact email
const EFFECTIVE = '2026-09-25';

export default function Privacy({ go }) {
  return (
    <article className="doc">
      <button className="crumb" type="button" onClick={() => go('library')}>← Recall</button>
      <h1>개인정보처리방침</h1>
      <p className="lede">시행일: {EFFECTIVE}</p>

      <h2>1. 수집하는 개인정보</h2>
      <p>Google 계정으로 로그인할 때 다음 정보를 받습니다: 이름, 이메일 주소, 프로필 사진 주소, Google 계정 식별자(UID). 이 밖에 이용자가 직접 입력한 학습 세트(제목, 용어, 정의)와 학습 진도를 저장합니다.</p>

      <h2>2. 이용 목적</h2>
      <p>로그인 및 본인 확인, 이용자의 학습 세트와 진도를 여러 기기에서 동기화하기 위해서만 사용합니다. 광고, 마케팅, 제3자 판매에 사용하지 않습니다.</p>

      <h2>3. 보관 기간 및 파기</h2>
      <p>계정이 유지되는 동안 보관합니다. 이용자는 언제든 <b>Account → Delete account</b>에서 계정과 모든 학습 데이터를 즉시 삭제할 수 있으며, 삭제된 데이터는 복구되지 않습니다.</p>

      <h2>4. 처리 위탁 및 국외 이전</h2>
      <p>서비스 운영을 위해 다음 업체의 인프라를 이용합니다.</p>
      <ul>
        <li>Google LLC (Firebase Authentication, Cloud Firestore) — 로그인 처리 및 데이터 저장. 데이터베이스 위치: 대한민국 서울 (asia-northeast3). 인증 정보는 Google의 글로벌 인프라에서 처리될 수 있습니다.</li>
        <li>Vercel Inc. (미국) — 웹사이트 호스팅. 접속 시 IP 주소 등 기술적 로그가 Vercel에 일시적으로 기록될 수 있습니다.</li>
      </ul>

      <h2>5. 브라우저 저장소</h2>
      <p>오프라인에서도 쓸 수 있도록 학습 세트의 사본과 화면 설정(답변 방식, 음성 속도 등)을 이용자의 브라우저에 저장합니다. 로그아웃하면 이 사본은 삭제됩니다. 광고·추적용 쿠키는 사용하지 않습니다.</p>

      <h2>6. 이용자의 권리</h2>
      <p>이용자는 자신의 개인정보를 열람·수정·삭제할 수 있습니다. 학습 세트는 앱에서 직접 수정·삭제할 수 있고, 계정 전체 삭제는 Account 페이지에서 할 수 있습니다. 그 밖의 요청은 아래 연락처로 보내 주세요.</p>

      <h2>7. 문의</h2>
      <p>개인정보 보호 책임자 연락처: <span className="mono-sel">{CONTACT}</span></p>

      <h2>8. 변경</h2>
      <p>이 방침이 바뀌면 이 페이지에 시행일과 함께 게시합니다.</p>
    </article>
  );
}
