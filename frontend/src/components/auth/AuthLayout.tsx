import { Outlet } from "react-router-dom";
import FluidBackground from "../FluidBackground";
import Logotype from "../svgs/Logotype";

export default function AuthLayout() {
  return (
    <div className="relative w-screen h-screen flex flex-col items-center p-7">
      <FluidBackground />
      <div className="w-full max-w-100 flex flex-col gap-14 items-start mt-28">
        <div className="w-64 select-none">
          <Logotype className="fill-white stroke-0"/>
        </div>
        <div className="flex flex-col gap-14 w-full">
          <Outlet />
        </div>
      </div>
    </div>
  )
}