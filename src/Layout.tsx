import { Outlet } from "react-router-dom";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import { Toaster } from "react-hot-toast";
import CursorTrail from "./components/CursorTrail";
import CarnivalLights from "./components/CarnivalLights";
import Fireworks from "./components/Fireworks";
import FloatingBalloons from "./components/FloatingBalloons";

const Layout = () => {
  return (
    <>
      <CursorTrail />
      <FloatingBalloons />
      <Fireworks />
      <CarnivalLights />
      <Navbar />
      <div className="sparkles">
        <Outlet />
      </div>
      <Footer />
      <Toaster position="bottom-center" />
    </>
  );
};

export default Layout;
