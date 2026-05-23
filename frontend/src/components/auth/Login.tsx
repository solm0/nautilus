import { useState } from "react"
import { login } from "../../api"
import { useNavigate } from "react-router-dom"
import Button, { LinkButton } from "../../components/util/Button"
import SystemMessage from "./SystemMessage"

export default function Login(){
  const [email,setEmail]=useState("")
  const [password,setPassword]=useState("")
  const [msg,setMsg]=useState("")

  const navigate = useNavigate();

  async function submit(){

    if (email.trim() && password.trim()) {
      const res=await login(email,password)
  
      if (res.access_token) {
        localStorage.setItem("token",res.access_token)
        navigate('/')
      } else {
        // detail이 배열이면 첫번째 msg만 꺼내고, 문자열이면 그대로
        const errMsg = Array.isArray(res.detail)
          ? res.detail[0].msg
          : res.detail || "error"
        setMsg(errMsg)
      }
    } else {
      setMsg("enter your email and password.")
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
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={e=>setPassword(e.target.value)}
          className="w-full border-2 border-neutral-50 text-neutral-50 rounded-sm px-3 py-2 focus:outline-none opacity-30 focus:opacity-80 transition-opacity"
        />

        <div className="flex flex-col gap-2 w-full">
          <SystemMessage msg={msg} />
          <Button text="Login" onClick={submit} fit />
        </div>
      </div>

      <div className="flex flex-col gap-2 text-neutral-50">
        <LinkButton text="Create an account" link="/signup" />
        <LinkButton text="Forgot password?" link="/reset-request" />
      </div>

    </>
  )
}