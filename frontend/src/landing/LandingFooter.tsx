import { Link } from "react-router-dom";

type LandingFooterProps = {
  backgroundHref: string;
  chromePrivacyHref: string;
  androidPrivacyHref: string;
  accountDeletionHref: string;
};

const linkClassName =
  "w-fit text-neutral-500 transition-colors hover:text-neutral-900";

function LandingFooter({
  backgroundHref,
  chromePrivacyHref,
  androidPrivacyHref,
  accountDeletionHref,
}: LandingFooterProps) {
  return (
    <footer className="relative px-5 py-12 text-neutral-900">
      <div className="mx-auto grid w-full max-w-300 grid-cols-3 gap-x-3 text-base leading-6 sm:w-auto sm:grid-cols-[13rem_8rem_16rem] sm:justify-end sm:gap-x-6">
        <div className="flex min-w-0 flex-col gap-2 [overflow-wrap:anywhere]">
          <a href="mailto:solmii.jeong@gmail.com" className={linkClassName}>
            solmii.jeong@gmail.com
          </a>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Link to={backgroundHref} className={linkClassName}>
            설계 배경
          </Link>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Link to={androidPrivacyHref} className={linkClassName}>
            Android 개인정보처리방침
          </Link>
          <Link to={chromePrivacyHref} className={linkClassName}>
            Chrome 개인정보처리방침
          </Link>
          <Link to={accountDeletionHref} className={linkClassName}>
            계정 삭제
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;
