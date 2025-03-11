import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Video from "./pages/Video";
import Privacy from "./pages/Privacy";
import About from "./pages/About";
import Settings from "./pages/Settings";
import NavBar from "./components/NavBar";
import Footer from "./components/Footer";

function App() {
  return (
    <Router>
      <div>
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/Video" element={<Video />} />
          <Route path="/Privacy" element={<Privacy />} />
          <Route path="/About" element={<About />} />
          <Route path="/Settings" element={<Settings />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
