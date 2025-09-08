import { Outlet } from "react-router-dom";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import { Toaster } from "react-hot-toast";
import CursorTrail from "./components/CursorTrail";

const Layout = () => {
  return (
    <>
      <CursorTrail />
      <Navbar />
      <Outlet />
      <Footer />
      <Toaster position="bottom-center" />
    </>
  );
};

export default Layout;
