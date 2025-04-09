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
import { ThemeProvider } from "./components/ThemeContext"; 

function App() {
  return (
    <ThemeProvider> 
      <Router>
        <div>
          <NavBar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/Chat" element={<Chat />} />
            <Route path="/video" element={<Video />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/about" element={<About />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
          <Footer />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
