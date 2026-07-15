import { useI18n } from "../../i18n";

export default function SystemMessage({msg}:{msg:string}){
  const { t } = useI18n();
  const successMsg=['email sent.', "your password was reset."]
  return (
    <div
      className={`${!successMsg.includes(msg) ? 'text-red-600' : 'text-neutral-200'} max-w-[25em] text-sm`}
    >
      {t(msg)}
    </div>
  )
}
