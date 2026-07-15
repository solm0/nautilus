import { useState } from "react"
import { requestReset } from "../../api"
import Button, { LinkButton } from "../../components/util/Button"
import SystemMessage from "./SystemMessage"
import { useI18n } from "../../i18n"

export default function ResetRequest(){

  const [email,setEmail]=useState("")
  const [msg,setMsg]=useState("")
  const { t } = useI18n();

  async function submit(){
    if (email.trim()) {
      const res=await requestReset(email);

      if (res.detail) {
        const errMsg = Array.isArray(res.detail)
          ? res.detail[0].msg
          : res.detail || "error"
        setMsg(errMsg)
      } else setMsg("email sent.")
    } else {
      setMsg("enter your email.")
    }
  }

  return(
    <>
      <div className="flex flex-col items-start gap-4 w-full text-lg">
        <input
          type="text"
          placeholder="email"
          value={email}
          onChange={e=>setEmail(e.target.value)}
          className="w-full border-2 border-neutral-50 text-neutral-50 rounded-sm px-3 py-2 focus:outline-none opacity-30 focus:opacity-80 transition-opacity"
          autoFocus
        />

        <div className="flex flex-col gap-2 w-full">
          <SystemMessage msg={msg} />
          <Button text={t("Request reset")} onClick={submit} fit />
        </div>
      </div>

      <div className="flex flex-col gap-2 text-neutral-50">
        <LinkButton text={t("Back to login")} link="/login" />
      </div>
    </>
  )
}
