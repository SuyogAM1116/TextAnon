import React, { useEffect, useRef, useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Peer from "simple-peer";
import io from "socket.io-client";
import { Button, Container, Row, Col, Form, Spinner, Alert } from "react-bootstrap";
import { FaPhoneSlash, FaMicrophone, FaMicrophoneSlash, FaVideo as FaVideoIcon, FaVideoSlash, FaRedo } from "react-icons/fa";
import { ThemeContext } from "../components/ThemeContext"; // Ensure path is correct

const Video = () => {
    const { theme } = useContext(ThemeContext);
    const navigate = useNavigate();
    const location = useLocation();

    const passedState = location.state || {};
    const initialPartnerID = passedState.partnerID;
    const initialPartnerName = passedState.partnerName;
    const initialIsInitiator = passedState.initiator;

    const [name, setName] = useState(localStorage.getItem('videoCallUsername') || "");
    const [nameConfirmed, setNameConfirmed] = useState(false);

    const [socket, setSocket] = useState(null);
    const [mySockID, setMySockID] = useState(null);
    const [partner, setPartner] = useState({ id: initialPartnerID || null, name: initialPartnerName || null });

    const [localStream, setLocalStream] = useState(null);
    const [peer, setPeer] = useState(null);
    const [isInitiator, setIsInitiator] = useState(initialIsInitiator !== undefined ? initialIsInitiator : false);

    const [callStatus, setCallStatus] = useState("Enter name to start.");
    const [error, setError] = useState('');
    const [callActive, setCallActive] = useState(false);
    const [isConnectingSocket, setIsConnectingSocket] = useState(false);

    const myVideoRef = useRef(null);
    const partnerVideoRef = useRef(null);
    const nameInputRef = useRef(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);

    const handleNameConfirm = (e) => {
        e.preventDefault();
        if (!name.trim()) { setError("Please enter a name."); return; }
        localStorage.setItem('videoCallUsername', name);
        setNameConfirmed(true);
        setCallStatus("Initializing..."); setError('');
    };

    // Effect for Socket Connection, Media, and Initial Event Listeners
    useEffect(() => {
        if (!nameConfirmed) {
            // If user goes back to name screen, ensure any existing socket is disconnected
            if (socket) {
                console.log("[Video.jsx] Name not confirmed, disconnecting existing socket.");
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        // Only create a new socket if one doesn't exist
        if (!socket) {
            console.log("[Video.jsx] Name confirmed. Establishing new Socket.IO connection...");
            setIsConnectingSocket(true);
            setCallStatus("Connecting to signaling server...");

            const newSocketInstance = io("ws://localhost:8080", {
                transports: ['websocket'],
                reconnectionAttempts: 3, // Or your preferred setting
            });

            newSocketInstance.on('connect', () => {
                setIsConnectingSocket(false);
                console.log("[Video.jsx] Socket connected:", newSocketInstance.id);
                setMySockID(newSocketInstance.id);
                setCallStatus("Socket connected. Registering...");
                newSocketInstance.emit('register', { name: name }); // Use the confirmed 'name'
                setError('');
            });

            newSocketInstance.on('connect_error', (err) => {
                setIsConnectingSocket(false);
                console.error("[Video.jsx] Socket connect_error:", err);
                setError(`Signaling server connection failed: ${err.message}. Is server on port 8080?`);
                setCallStatus("Connection Error");
            });

            newSocketInstance.on('disconnect', (reason) => {
                setIsConnectingSocket(false);
                console.log("[Video.jsx] Socket disconnected:", reason);
                setCallStatus(`Signaling server disconnected: ${reason}`);
                if (peer) peer.destroy();
                setPeer(null); setCallActive(false); 
                // Don't reset partner here, as it might be a temporary disconnect.
                // Partner leaving should be handled by 'chatEnded' or 'partner-left-video'
            });

            newSocketInstance.on('userID', (data) => {
                if (data.userID === newSocketInstance.id) {
                    console.log("[Video.jsx] Registered with server. UserID (mySockID):", newSocketInstance.id, "Name:", name);
                    setCallStatus("Registered. Getting media & waiting for partner...");
                    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                        .then(currentStream => {
                            setLocalStream(currentStream);
                            if (myVideoRef.current) {
                                myVideoRef.current.srcObject = currentStream;
                                myVideoRef.current.play().catch(e => console.warn("[Video.jsx] Error playing myVideo:", e));
                            }
                        })
                        .catch(err => {
                            console.error("[Video.jsx] Failed to get user media:", err);
                            setError("Could not access camera/microphone. Check permissions and reload.");
                            setCallStatus("Media access failed.");
                        });
                }
            });
            
            newSocketInstance.on('partnerConnected', (data) => {
                if (mySockID && data.partnerID !== mySockID) {
                    console.log(`[Video.jsx] Partner connected: ${data.partnerName} (${data.partnerID}). My ID: ${mySockID}`);
                    setPartner({ id: data.partnerID, name: data.partnerName });
                    if (initialIsInitiator === undefined) {
                        const amIInitiator = mySockID < data.partnerID;
                        setIsInitiator(amIInitiator);
                        setCallStatus(amIInitiator ? `Paired. Initiating video call to ${data.partnerName}...` : `Paired. Waiting for call from ${data.partnerName}...`);
                    } else {
                         setIsInitiator(initialIsInitiator);
                         setCallStatus(initialIsInitiator ? `Paired. Initiating video call to ${data.partnerName}...` : `Paired. Waiting for call from ${data.partnerName}...`);
                    }
                }
            });
            
            newSocketInstance.on('chatEnded', () => { // General event if partner leaves pairing pool
                setCallStatus("Partner has left or pairing ended. Call cannot proceed.");
                if(peer) peer.destroy();
                setPeer(null); setCallActive(false); setPartner({ id: null, name: null });
            });
            
            setSocket(newSocketInstance); // Store the new socket instance in state

            return () => {
                console.log("[Video.jsx] Cleanup: Disconnecting socket instance", newSocketInstance.id);
                newSocketInstance.disconnect();
            };
        } else if (socket && socket.disconnected && nameConfirmed) {
            // If socket exists but is disconnected, and we intend to be connected
            console.log("[Video.jsx] Socket exists but disconnected, attempting to reconnect.");
            socket.connect();
            setIsConnectingSocket(true);
            setCallStatus("Reconnecting to signaling server...");
        }

    }, [nameConfirmed, name, initialIsInitiator]); // Removed `socket` and `mySockID` from direct dependencies to manage lifecycle internally.


    // Effect for Initializing Peer Connection & Peer-related Socket Listeners
    useEffect(() => {
        // Guard conditions: ensure all necessary pieces are ready and no peer already exists
        if (!socket || !socket.connected || !localStream || !partner.id || !mySockID || peer) {
            if (peer && (!socket || !socket.connected || !localStream || !partner.id || !mySockID)) {
                 // If dependencies become invalid while a peer exists, destroy the peer.
                console.log("[Video.jsx] Peer exists but dependencies are invalid. Destroying peer.");
                peer.destroy();
                setPeer(null);
            }
            return; 
        }
        
        // Determine if this client should initiate the call for this pairing
        // This could also be passed via navigation state if Chat.jsx determines the initiator
        const shouldThisClientInitiate = initialIsInitiator !== undefined ? initialIsInitiator : (mySockID < partner.id);
        setIsInitiator(shouldThisClientInitiate); // Update state if determined here
        console.log(`[Video.jsx] Initiator status for this pairing: ${shouldThisClientInitiate}`);

        if (shouldThisClientInitiate) {
            console.log(`[Video.jsx] INITIATOR: About to create Peer. MySockID: ${mySockID}, PartnerID: ${partner.id}`);
            const newPeerInstance = createPeerInstance(true); // True for initiator
            if (newPeerInstance) setPeer(newPeerInstance);
        }
        // If not initiator, peer creation is triggered by 'call-user' (offer received)
        
        const handleCallUser = (data) => { // Offer from partner
            if (data.from === partner.id && !shouldThisClientInitiate) { // Ensure this client is the intended callee
                console.log("[Video.jsx] RECEIVER: Received 'call-user' (offer) from:", data.from);
                if (peer) { // If a peer somehow exists (e.g. from a race condition), destroy it
                    console.warn("[Video.jsx] Receiver already had a peer, destroying it before accepting new call.");
                    peer.destroy();
                }
                const receivingPeer = createPeerInstance(false); // Create peer as receiver
                if(receivingPeer) { 
                    receivingPeer.signal(data.signal); // Process the offer
                    setPeer(receivingPeer);
                }
            }
        };
        const handleCallAccepted = (data) => { // Answer from partner
            if (data.from === partner.id && shouldThisClientInitiate && peer) {
                console.log("[Video.jsx] INITIATOR: Received 'call-accepted' (answer) from:", data.from);
                peer.signal(data.signal); 
            }
        };
        const handleIceCandidate = (data) => { // ICE from partner
            if (data.from === partner.id && peer && data.candidate) {
                console.log("[Video.jsx] Received 'ice-candidate' from:", data.from);
                peer.signal({ candidate: data.candidate });
            }
        };
        const handlePartnerLeftVideo = () => { // Custom event from server
            console.log("[Video.jsx] Partner signaled they left the video call.");
            setCallStatus("Partner has ended the call.");
            if (peer) peer.destroy(); 
            setPeer(null); setCallActive(false);
        };

        socket.on("call-user", handleCallUser);
        socket.on("call-accepted", handleCallAccepted);
        socket.on("ice-candidate", handleIceCandidate);
        socket.on("partner-left-video", handlePartnerLeftVideo);

        return () => {
            console.log("[Video.jsx] Cleaning up peer-related socket listeners.");
            socket.off("call-user", handleCallUser);
            socket.off("call-accepted", handleCallAccepted);
            socket.off("ice-candidate", handleIceCandidate);
            socket.off("partner-left-video", handlePartnerLeftVideo);
            // The peer instance itself is destroyed in its own event handlers ('close', 'error') or by endCall/skipCall
        };
    }, [socket, localStream, partner.id, mySockID, initialIsInitiator]); // Removed 'isInitiator' and 'peer' state from deps to avoid loops on their set

    const createPeerInstance = (amInitiator) => {
        if (!localStream) { setError("Local media stream not found for peer creation."); return null; }
        console.log(`[Video.jsx] createPeerInstance. Initiator: ${amInitiator}, MySockID: ${mySockID}, PartnerID: ${partner.id}`);
        
        const newPeer = new Peer({ 
            initiator: amInitiator, 
            trickle: true, 
            stream: localStream,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }
        });

        newPeer.on("signal", (data) => {
            if (!socket || !partner.id || !mySockID) { console.warn("Cannot send signal, missing socket/partner/myID"); return; }
            console.log(`[Video.jsx] Peer (${amInitiator ? 'I' : 'R'}) 'signal'. Type:`, data.type || (data.candidate ? 'candidate' : 'unknown'));
            
            if (data.type === 'offer') socket.emit("callUser", { signalData: data, to: partner.id, from: mySockID });
            else if (data.type === 'answer') socket.emit("acceptCall", { signalData: data, to: partner.id, from: mySockID });
            else if (data.candidate) socket.emit("ice-candidate", { candidate: data.candidate, to: partner.id, from: mySockID });
        });
        newPeer.on("stream", (remoteStream) => {
            if (partnerVideoRef.current) {
                partnerVideoRef.current.srcObject = remoteStream;
                partnerVideoRef.current.play().catch(e => console.warn("[Video.jsx] Error playing partner video:", e));
            }
            setCallStatus(`Connected with ${partner.name || 'Partner'}`);
            setCallActive(true); setError(''); 
        });
        newPeer.on("connect", () => {setCallActive(true); setError(''); console.log("[Video.jsx] Peer 'connect' (data channel).");});
        newPeer.on("iceStateChange", (iceState) => { 
            console.log(`[Video.jsx] Peer (${amInitiator ? 'I' : 'R'}) ICE state:`, iceState);
            if(iceState === "connected" || iceState === "completed") {setCallStatus(`Video stream active`); setCallActive(true); setError('');}
            else if (iceState === "failed") { setError("ICE Connection failed. Video may not work."); setCallStatus("Connection failed"); setCallActive(false); }
            else if (iceState === "disconnected" || iceState === "closed") { setCallStatus("Video connection lost or closed."); setCallActive(false); }
        });
        newPeer.on("close", () => { console.log(`[Video.jsx] Peer (${amInitiator ? 'I' : 'R'}) 'close'.`); setCallStatus("Call ended."); setCallActive(false); setPeer(null); }); // Nullify peer state
        newPeer.on("error", (err) => { 
            console.error(`[Video.jsx] Peer (${amInitiator ? 'I' : 'R'}) error:`, err); 
            setError(`WebRTC Error: ${err.message}.`); 
            setCallStatus("Call Failed"); 
            setCallActive(false); 
            if(newPeer && !newPeer.destroyed) newPeer.destroy();
            setPeer(null); // Nullify peer state
        });
        return newPeer;
    };

    const endCall = () => { /* ... Same ... */ 
        if (socket && partner.id && mySockID) socket.emit("video-call-ended", { to: partner.id, from: mySockID });
        if (peer) { peer.destroy(); setPeer(null); } 
        if (localStream) localStream.getTracks().forEach(track => track.stop());
        setCallStatus("Call ended by you."); setCallActive(false);
        navigate("/"); 
    };
    const skipCall = () => { endCall(); };
    const toggleMute = () => { /* ... same ... */ 
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setIsMuted(!audioTrack.enabled); }
        }
    };
    const toggleVideo = () => { /* ... same ... */
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) { videoTrack.enabled = !videoTrack.enabled; setIsVideoEnabled(videoTrack.enabled); }
        }
    };
    
    useEffect(() => { if (!nameConfirmed && nameInputRef.current) nameInputRef.current.focus(); }, [nameConfirmed]);

    const videoBaseStyle = { /* ... same ... */ 
        width: "clamp(280px, 40vw, 550px)", aspectRatio: "4/3",
        backgroundColor: theme === "dark" ? "#111" : "#222", borderRadius: "12px",
        margin: "10px", objectFit: "cover",
        border: `2px solid ${theme === "dark" ? "#555" : "#ddd"}`,
        boxShadow: "0 5px 15px rgba(0,0,0,0.2)"
    };
    const myVideoStyle = { ...videoBaseStyle, transform: 'scaleX(-1)' };
    const partnerVideoStyle = { ...videoBaseStyle };

    if (!nameConfirmed) { /* ... Name input form JSX - fixed div in p for status ... */ 
        return (
            <div className={`d-flex align-items-center justify-content-center vh-100 ${theme === 'dark' ? 'bg-dark text-light' : 'bg-light text-dark'}`}>
                <Container>
                    <Row className="justify-content-center">
                        <Col md={6} lg={4} className="text-center">
                            <h2 className="mb-3">Enter Name for Video Chat</h2>
                            <Form onSubmit={handleNameConfirm}>
                                <Form.Group className="mb-3">
                                    <Form.Control ref={nameInputRef} type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus className={theme === 'dark' ? 'form-control-dark' : ''} />
                                </Form.Group>
                                <Button variant="primary" type="submit" disabled={!name.trim() || isConnectingSocket}>
                                    {isConnectingSocket ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1"/> : null}
                                    Start Video Session
                                </Button>
                            </Form>
                            {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
                            {callStatus && !error && 
                                <div className={`mt-3 text-muted ${theme === 'dark' ? 'text-light-emphasis' : ''}`}> {/* Changed p to div */}
                                    {(callStatus.includes("Connecting") || callStatus.includes("Initializing") || callStatus.includes("Registering")) && isConnectingSocket && <Spinner size="sm" className="me-1"/>}
                                    {callStatus}
                                </div>
                            }
                        </Col>
                    </Row>
                </Container>
            </div>
        );
    }

    // Main Video Call UI
    return ( /* ... Main Video Call UI JSX ... */ 
        <div className={`d-flex flex-column align-items-center justify-content-start ${theme === "dark" ? "theme-dark" : ""}`} style={{ minHeight: "100vh", backgroundColor: theme === "dark" ? "#181a1b" : "#f8f9fa", color: theme === "dark" ? "#e0e0e0" : "#212529", padding: '20px 0', boxSizing: 'border-box' }}>
            <Container fluid="lg">
                <Row className="justify-content-center text-center mb-2">
                    <Col>
                        <h3 className="mt-3 mb-1">Video Call {partner.name && callActive ? `with ${partner.name}` : (partner.name ? `with ${partner.name}`: "")}</h3>
                        <p className={`mb-2 ${theme === 'dark' ? 'text-white-50' : 'text-muted'}`}>{callStatus}</p>
                        {error && <Alert variant="danger" size="sm" className="py-1 px-2 d-inline-block">{error}</Alert>}
                    </Col>
                </Row>

                {!localStream && !error && nameConfirmed && (
                    <div className="text-center my-5">
                        <Spinner animation="border" variant={theme === 'dark' ? 'light' : 'primary'}/>
                        <p className="mt-2">Initializing camera & microphone...</p>
                    </div>
                )}

                {localStream && (
                     <Row className="justify-content-center align-items-center gx-3 gy-3 mb-3">
                        <Col xs={12} md={6} className="d-flex flex-column align-items-center">
                            <video ref={myVideoRef} autoPlay muted playsInline style={myVideoStyle} />
                            <p className="mt-1 mb-0 small">{name || "You"}</p>
                        </Col>
                        <Col xs={12} md={6} className="d-flex flex-column align-items-center">
                            {callActive && peer ? (
                                <video ref={partnerVideoRef} autoPlay playsInline style={partnerVideoStyle} />
                            ) : (
                                <div style={{...partnerVideoStyle, display:'flex', alignItems:'center', justifyContent:'center', backgroundColor: theme === 'dark' ? '#2a2a2a' : '#e9ecef'}} className="text-muted">
                                    {isConnectingSocket || callStatus.includes("Calling") || callStatus.includes("Waiting") ? <Spinner animation="border" size="sm"/> : <span>Partner's Video</span>}
                                </div>
                            )}
                            <p className="mt-1 mb-0 small">{partner.name || "Partner"}</p>
                        </Col>
                    </Row>
                )}

                {localStream && nameConfirmed && (
                    <Row className="justify-content-center">
                        <Col xs="auto" className="controls d-flex justify-content-center align-items-center gap-2 flex-wrap p-3 rounded" style={{backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'}}>
                            <Button variant={isMuted ? "outline-secondary" : "outline-primary"} onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"} size="lg" className="rounded-circle p-3 lh-1">
                                {isMuted ? <FaMicrophoneSlash size="1.2em"/> : <FaMicrophone size="1.2em"/>}
                            </Button>
                            <Button variant={!isVideoEnabled ? "outline-secondary" : "outline-primary"} onClick={toggleVideo} title={!isVideoEnabled ? "Enable Video" : "Disable Video"}  size="lg" className="rounded-circle p-3 lh-1">
                                {!isVideoEnabled ? <FaVideoSlash size="1.2em"/> : <FaVideoIcon size="1.2em"/>}
                            </Button>
                            <Button variant="danger" onClick={endCall} title="End Call"  size="lg" className="rounded-circle p-3 lh-1">
                                <FaPhoneSlash size="1.2em"/>
                            </Button>
                            <Button variant="outline-warning" onClick={skipCall} title="Skip/End Call"  size="lg" className="rounded-circle p-3 lh-1">
                                <FaRedo size="1.2em"/>
                            </Button>
                        </Col>
                    </Row>
                )}
                 {nameConfirmed && !callActive && !isConnectingSocket && localStream && (
                     <Button className="mt-4" variant="outline-secondary" onClick={() => navigate("/")}>Back to Home</Button>
                 )}
            </Container>
        </div>
    );
};

export default Video;