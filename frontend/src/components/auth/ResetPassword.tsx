import { useState } from "react"
import { resetPassword } from "../../api"
import SystemMessage from "./SystemMessage"
import Button, { LinkButton } from "../../components/util/Button"

export default function ResetPassword(){

  const url=new URL(window.location.href)
  const token=url.searchParams.get("token")||""

  const [pw,setPw]=useState("")
  const [msg,setMsg]=useState("")

  async function submit(){
    if (pw.trim()) {
      const res=await resetPassword(token,pw);

      if (res.detail) {
        const errMsg = Array.isArray(res.detail)
          ? res.detail[0].msg
          : res.detail || "error"
        setMsg(errMsg)
      } else setMsg("your password was reset.")
    } else {
      setMsg('enter your new password.')
    }
  }

  return(
    <>
      <div className="flex flex-col items-start gap-4 w-full text-lg">
        <input
          type="password"
          placeholder="password"
          value={pw}
          onChange={e=>setPw(e.target.value)}
          className="w-full border-2 border-neutral-50 text-neutral-50 rounded-sm px-3 py-2 focus:outline-none opacity-30 focus:opacity-80 transition-opacity"
        />

        <div className="flex flex-col gap-2 w-full">
          <SystemMessage msg={msg} />
          <Button text="change password" onClick={submit} fit />
        </div>

      </div>

      {msg === 'your password was reset.' && <LinkButton link="/login" text="login" />}
    </>
  )
}