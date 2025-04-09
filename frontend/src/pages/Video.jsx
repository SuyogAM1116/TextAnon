import React, { useEffect, useRef, useState, useContext } from "react";
import { ThemeContext } from "../components/ThemeContext";
import Peer from "simple-peer";

const Video = () => {
    const { theme } = useContext(ThemeContext);
    const [username, setUsername] = useState("");
    const [nameConfirmed, setNameConfirmed] = useState(false);
    const [stream, setStream] = useState(null);
    const [receivingCall, setReceivingCall] = useState(false);
    const [callerSignal, setCallerSignal] = useState(null);
    const [callAccepted, setCallAccepted] = useState(false);
    const [callStarted, setCallStarted] = useState(false);
    const [peerConnected, setPeerConnected] = useState(false);
    const [muted, setMuted] = useState(false);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [mediaStatus, setMediaStatus] = useState("Waiting to start media");

    const socketRef = useRef();
    const userVideoRef = useRef();
    const partnerVideoRef = useRef();
    const peerRef = useRef();
    const streamRef = useRef();

    useEffect(() => {
        console.log(`${new Date().toLocaleTimeString()} - useEffect: Component mounted`);
        socketRef.current = new WebSocket("wss://textanon.onrender.com");
        console.log(`${new Date().toLocaleTimeString()} - useEffect: WebSocket connecting to wss://textanon.onrender.com`);

        socketRef.current.onopen = () => {
            console.log(`${new Date().toLocaleTimeString()} - WebSocket connected to signaling server`);
        };

        socketRef.current.onerror = (error) => {
            console.error(`${new Date().toLocaleTimeString()} - WebSocket connect_error:`, error);
            setMediaStatus(`Signaling server connection error: ${error.message || error}`);
        };

        socketRef.current.onclose = (event) => {
            console.log(`${new Date().toLocaleTimeString()} - WebSocket disconnected:`, event.reason);
            setMediaStatus(`Disconnected from signaling server: ${event.reason || 'Connection closed'}`);
        };

        socketRef.current.onmessage = (event) => {
            try {
                const parsedMessage = JSON.parse(event.data);

                if (parsedMessage.type === "hey") {
                    console.log(`${new Date().toLocaleTimeString()} - WebSocket message 'hey' received, receiving call from:`, parsedMessage.callerID, "Signal:", parsedMessage.signal);
                    setReceivingCall(true);
                    setCallerSignal(parsedMessage.signal);
                } else if (parsedMessage.type === "ice-candidate") {
                    if (peerRef.current && parsedMessage.candidate) {
                        console.log(`${new Date().toLocaleTimeString()} - WebSocket message 'ice-candidate' received, adding ICE candidate to peer:`, parsedMessage.candidate);
                        peerRef.current.signal(parsedMessage.candidate);
                    } else {
                        console.warn(`${new Date().toLocaleTimeString()} - WebSocket message 'ice-candidate' received, but peerRef.current is not ready or candidate is missing.`);
                    }
                } else if (parsedMessage.type === 'callAccepted') {
                    console.log(`${new Date().toLocaleTimeString()} - WebSocket message 'callAccepted' received, signaling peer with answer:`, parsedMessage.signal);
                    setCallAccepted(true);
                    if (peerRef.current) {
                        peerRef.current.signal(parsedMessage.signal);
                    } else {
                        console.warn(`${new Date().toLocaleTimeString()} - WebSocket message 'callAccepted' received, but peerRef.current is not initialized yet.`);
                    }
                }

            } catch (error) {
                console.error(`${new Date().toLocaleTimeString()} - Error parsing WebSocket message:`, error);
            }
        };

        return () => {
            console.log(`${new Date().toLocaleTimeString()} - useEffect cleanup: Component unmounting`);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                console.log(`${new Date().toLocaleTimeString()} - useEffect cleanup: Local stream tracks stopped`);
            }
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.close();
                console.log(`${new Date().toLocaleTimeString()} - useEffect cleanup: WebSocket disconnected`);
            }
        };
    }, []);

    const startVideoCall = () => {
        console.log(`${new Date().toLocaleTimeString()} - startVideoCall: Starting video call initiation`);
        setCallStarted(true);
        setMediaStatus("Getting media devices...");

        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(currentStream => {
                console.log(`${new Date().toLocaleTimeString()} - getUserMedia success.`);
                setStream(currentStream);
                streamRef.current = currentStream;
                if (userVideoRef.current) {
                    userVideoRef.current.srcObject = currentStream;
                }
                setMediaStatus("Media devices ready, connecting...");
                initiatePeerConnection(currentStream);
            })
            .catch(error => {
                console.error(`${new Date().toLocaleTimeString()} - getUserMedia error:`, error);
                setMediaStatus(`Error accessing media: ${error.message}`);
                setCallStarted(false);
            });
    };

    const initiatePeerConnection = (currentStream) => {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream: currentStream,
        });
        peerRef.current = peer;

        peer.on("signal", signal => {
            console.log(`${new Date().toLocaleTimeString()} - Peer (Initiator) 'signal' event. connectionState: ${peer.connectionState}`);
            console.log(`${new Date().toLocaleTimeString()} - INITIATOR - Sending Offer SDP:`, signal);
            socketRef.current.send(JSON.stringify({ type: "callUser", signal }));
        });

        peer.on('icecandidate', candidate => {
            if (candidate) {
                console.log(`${new Date().toLocaleTimeString()} - Peer (Initiator) 'icecandidate' event. connectionState: ${peer.connectionState}`, candidate);
                socketRef.current.send(JSON.stringify({ type: "ice-candidate", candidate: candidate }));
            }
        });

        peer.on("stream", remoteStream => {
            console.log(`${new Date().toLocaleTimeString()} - Peer (Initiator) 'stream' event. connectionState: ${peer.connectionState}`, remoteStream);
            if (partnerVideoRef.current) {
                partnerVideoRef.current.srcObject = remoteStream;
            }
            setPeerConnected(true);
        });

        peer.on("connect", () => {
            console.log(`${new Date().toLocaleTimeString()} - Peer (Initiator) 'connect' event. connectionState: ${peer.connectionState}`);
        });

        peer.on("error", err => {
            console.error(`${new Date().toLocaleTimeString()} - Peer (Initiator) 'error' event. connectionState: ${peer.connectionState}`, err);
            setMediaStatus(`Peer connection error: ${err.message || 'Unknown error'}`);
            setCallStarted(false);
        });
    };

    useEffect(() => {
        if (receivingCall && !callAccepted && streamRef.current && callerSignal) {
            console.log(`${new Date().toLocaleTimeString()} - useEffect [receivingCall]: Answering incoming call. connectionState (before Peer creation): ${peerRef.current ? peerRef.current.connectionState : 'No Peer'}`);

            const peer = new Peer({
                initiator: false,
                trickle: false,
                // stream: streamRef.current,  // <-- Stream removed here for answerer
            });
            peerRef.current = peer;
            console.log(`${new Date().toLocaleTimeString()} - useEffect [receivingCall]: Peer (Answerer) created. connectionState (after Peer creation): ${peerRef.current.connectionState}`);

            console.log(`${new Date().toLocaleTimeString()} - ANSWERER - Received Offer SDP (callerSignal):`, callerSignal);
            console.log(`${new Date().toLocaleTimeString()} - useEffect [receivingCall]: Signaling with callerSignal (Offer SDP). connectionState (before signal): ${peerRef.current.connectionState}`);
            peer.signal(callerSignal);
            console.log(`${new Date().toLocaleTimeString()} - useEffect [receivingCall]: Signaled with callerSignal (Offer SDP). connectionState (after signal): ${peerRef.current.connectionState}`);

            peer.on("signal", signal => {
                console.log(`${new Date().toLocaleTimeString()} - Peer (Answerer) 'signal' event. connectionState: ${peerRef.current.connectionState}`);
                console.log(`${new Date().toLocaleTimeString()} - ANSWERER - Sending Answer SDP:`, signal);
                socketRef.current.send(JSON.stringify({ type: "acceptCall", signal }));
            });

            peer.on('icecandidate', candidate => {
                if (candidate) {
                    console.log(`${new Date().toLocaleTimeString()} - Peer (Answerer) 'icecandidate' event. connectionState: ${peerRef.current.connectionState}`, candidate);
                    socketRef.current.send(JSON.stringify({ type: "ice-candidate", candidate: candidate }));
                }
            });

            peer.on("stream", remoteStream => {
                console.log(`${new Date().toLocaleTimeString()} - Peer (Answerer) 'stream' event. connectionState: ${peerRef.current.connectionState}`, remoteStream);
                if (partnerVideoRef.current) {
                    partnerVideoRef.current.srcObject = remoteStream;
                }
                setPeerConnected(true);
            });

            peer.on("connect", () => {
                console.log(`${new Date().toLocaleTimeString()} - Peer (Answerer) 'connect' event. connectionState: ${peerRef.current.connectionState}`);
            });

            peer.on("error", err => {
                console.error(`${new Date().toLocaleTimeString()} - Peer (Answerer) 'error' event. connectionState: ${peerRef.current.connectionState}`, err);
                setMediaStatus(`Peer connection error (answering): ${err.message || 'Unknown error'}`);
                setReceivingCall(false);
            });

            setCallAccepted(true);
            setCallStarted(true);
        }
    }, [receivingCall, callerSignal, callAccepted]);

    const endCall = () => {
        console.log(`${new Date().toLocaleTimeString()} - endCall: Ending call`);
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
            console.log(`${new Date().toLocaleTimeString()} - endCall: Peer connection destroyed`);
        }

        setCallStarted(false);
        setReceivingCall(false);
        setCallerSignal(null);
        setCallAccepted(false);
        setPeerConnected(false);
        setMediaStatus("Ready to start call");

        if (partnerVideoRef.current && partnerVideoRef.current.srcObject) {
            partnerVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
            partnerVideoRef.current.srcObject = null;
            console.log(`${new Date().toLocaleTimeString()} - endCall: Partner video stream stopped and cleared`);
        }
        console.log(`${new Date().toLocaleTimeString()} - endCall: Call ended, state reset`);
    };

    const handleSkip = () => {
        console.log(`${new Date().toLocaleTimeString()} - handleSkip: Skipping to next call`);
        endCall();
        setTimeout(() => {
            startVideoCall();
            console.log(`${new Date().toLocaleTimeString()} - handleSkip: startVideoCall called after delay`);
        }, 1000);
    };

    const sendEmoji = emoji => {
        alert(`Sent emoji: ${emoji}`);
    };

    const toggleMute = () => {
        if (streamRef.current && streamRef.current.getAudioTracks()) {
            streamRef.current.getAudioTracks().forEach((track) => (track.enabled = !muted));
            setMuted(!muted);
            console.log(`${new Date().toLocaleTimeString()} - toggleMute: Audio Muted: ${!muted}`);
        } else {
            console.warn(`${new Date().toLocaleTimeString()} - toggleMute: No local stream or audio tracks available`);
        }
    };

    const toggleVideo = () => {
        if (streamRef.current && streamRef.current.getVideoTracks()) {
            streamRef.current.getVideoTracks().forEach((track) => (track.enabled = !videoEnabled));
            setVideoEnabled(!videoEnabled);
            console.log(`${new Date().toLocaleTimeString()} - toggleVideo: Video Enabled: ${!videoEnabled}`);
        } else {
            console.warn(`${new Date().toLocaleTimeString()} - toggleVideo: No local stream or video tracks available`);
        }
    };

    return (
        <div
            style={{
                backgroundColor: theme === "dark" ? "#121212" : "#f8f9fa",
                color: theme === "dark" ? "#ffffff" : "#333333",
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "column",
                padding: "20px",
                position: "relative",
            }}
        >
            {!nameConfirmed ? (
                <div
                    style={{
                        backgroundColor: theme === "dark" ? "#1e1e1e" : "#ffffff",
                        padding: "25px",
                        borderRadius: "10px",
                        textAlign: "center",
                        width: "400px",
                        boxShadow: theme === "dark"
                            ? "0px 4px 10px rgba(255, 255, 255, 0.2)"
                            : "0px 4px 10px rgba(0, 0, 0, 0.2)",
                    }}
                >
                    <h2 style={{ color: theme === "dark" ? "#ffffff" : "#222222" }}>
                        Anonymous Video Call
                    </h2>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Choose a name"
                        style={inputStyle(theme)}
                    />
                    <button
                        onClick={() => setNameConfirmed(username.trim() !== "")}
                        style={startButtonStyle}
                    >
                        Start Video
                    </button>
                </div>
            ) : !callStarted ? (
                <div style={{ textAlign: "center" }}>
                    <h2>Anonymous Video Call</h2>
                    <p>Status: {mediaStatus}</p>
                    <button onClick={startVideoCall} style={startButtonStyle}>Start Video Call</button>
                </div>
            ) : (
                <div style={{ textAlign: "center" }}>
                    <h2>Anonymous Video Call</h2>
                    <p>Status: {mediaStatus}</p>
                    <div style={videoContainerStyle}>
                        <div>
                            <p>You</p>
                            <video ref={userVideoRef} autoPlay muted playsInline style={videoStyle} />
                        </div>
                        <div>
                            <p>Stranger</p>
                            <video ref={partnerVideoRef} autoPlay playsInline style={videoStyle} placeholder="Waiting for Stranger Video" />
                        </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", gap: "15px" }}>
                        <button onClick={toggleMute} style={emojiButtonStyle}>
                            <span className="material-icons">{muted ? "mic_off" : "mic"}</span>
                        </button>
                        <button onClick={toggleVideo} style={emojiButtonStyle}>
                            <span className="material-icons">{videoEnabled ? "videocam_off" : "videocam"}</span>
                        </button>
                        <button onClick={endCall} style={endButtonStyle}>
                            <span className="material-icons">call_end</span>
                        </button>
                    </div>

                    <div style={{ marginTop: "10px" }}>
                        <button onClick={handleSkip} style={skipButtonStyle}>Skip to Next</button>
                    </div>
                </div>
            )}

            <div
                style={{
                    position: "absolute",
                    bottom: "20px",
                    right: "20px",
                    width: "50px",
                    height: "50px",
                    cursor: "pointer",
                }}
            >
                <img
                    src="/msg.png"
                    alt="Message"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
            </div>
        </div>
    );
};

export default Video;

const videoStyle = {
    width: "600px",
    height: "400px",
    backgroundColor: "#000",
    borderRadius: "10px",
};

const videoContainerStyle = {
    display: "flex",
    gap: "20px",
    marginTop: "20px",
    justifyContent: "center",
};

const emojiButtonStyle = {
    width: "80px",
    height: "80px",
    fontSize: "40px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const endButtonStyle = {
    ...emojiButtonStyle,
    backgroundColor: "red",
};

const skipButtonStyle = {
    padding: "12px 24px",
    backgroundColor: "#6c757d",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "18px",
    marginTop: "10px",
};

const startButtonStyle = {
    width: "100%",
    padding: "12px",
    backgroundColor: "#198754",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "16px",
    marginTop: "10px",
};

const inputStyle = (theme) => ({
    width: "100%",
    padding: "12px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    fontSize: "16px",
    textAlign: "center",
    outline: "none",
    backgroundColor: theme === "dark" ? "#333" : "#fff",
    color: theme === "dark" ? "#ffffff" : "#222",
});