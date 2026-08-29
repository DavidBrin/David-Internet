import SwiftUI
import CocoaMQTT
import Combine

// ==========================================
// 1. THE NETWORK MANAGER (Logic Layer)
// ==========================================
class MQTTManager: NSObject, ObservableObject, CocoaMQTTDelegate {
    @Published var isConnected = false
    @Published var statusMessage = "Initializing Public..."
    
    // PUBLIC BROKER SETTINGS (No Security = No Blocks)
    let mqtt = CocoaMQTT(clientID: "iPhone_" + String(Int.random(in: 0...9999)),
                         host: "broker.hivemq.com",
                         port: 1883)

    func setup() {
        // 1. CLEAR AUTHENTICATION
        mqtt.username = nil
        mqtt.password = nil
        
        // 2. DISABLE SSL (Crucial for Public Broker)
        mqtt.enableSSL = false
        
        // 3. Connection Settings
        mqtt.keepAlive = 60
        mqtt.cleanSession = true
        mqtt.autoReconnect = true
        mqtt.delegate = self
        
        // 4. Connect
        print("🌍 Connecting to PUBLIC broker...")
        _ = mqtt.connect()
    }

    func publish(topic: String, message: String) {
        print("📤 Sending [\(message)] to: \(topic)")
        mqtt.publish(topic, withString: message, qos: .qos0)
    }

    func forceReset() {
        print("🔄 Force Resetting Connection...")
        mqtt.disconnect()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.setup()
        }
    }

    // --- DELEGATE FUNCTIONS ---
    func mqtt(_ mqtt: CocoaMQTT, didConnectAck ack: CocoaMQTTConnAck) {
        print("✅ PUBLIC BROKER ACK: \(ack)")
        DispatchQueue.main.async {
            if ack == .accept {
                self.isConnected = true
                self.statusMessage = "Connected to Public Broker"
            } else {
                self.statusMessage = "Failed: \(ack)"
            }
        }
    }

    func mqttDidDisconnect(_ mqtt: CocoaMQTT, withError err: Error?) {
        print("❌ Disconnected: \(err?.localizedDescription ?? "Unknown")")
        DispatchQueue.main.async {
            self.isConnected = false
            self.statusMessage = "Disconnected"
        }
    }
    
    // Required Boilerplate
    func mqtt(_ mqtt: CocoaMQTT, didSubscribeTopics success: NSDictionary, failed: [String]) {}
    func mqtt(_ mqtt: CocoaMQTT, didPublishMessage message: CocoaMQTTMessage, id: UInt16) {}
    func mqtt(_ mqtt: CocoaMQTT, didPublishAck id: UInt16) {}
    func mqtt(_ mqtt: CocoaMQTT, didReceiveMessage message: CocoaMQTTMessage, id: UInt16) {}
    func mqtt(_ mqtt: CocoaMQTT, didUnsubscribeTopics topics: [String]) {}
    func mqttDidPing(_ mqtt: CocoaMQTT) {}
    func mqttDidReceivePong(_ mqtt: CocoaMQTT) {}
}

// ==========================================
// 2. THE USER INTERFACE (Visual Layer)
// ==========================================
struct ContentView: View {
    @StateObject var mqttManager = MQTTManager()
    @State private var isArmed = false
    @State private var commandLogs: [String] = []
    
    // YOUR TOPIC
    let topic = "ucsd/hardhack/brent/command"

    var body: some View {
        ZStack {
            // Dynamic Background
            Color(isArmed ? .red : .black)
                .opacity(isArmed ? 0.2 : 1.0)
                .ignoresSafeArea()
                .animation(.easeInOut(duration: 0.5), value: isArmed)

            VStack(spacing: 10) {
                
                // --- HEADER ---
                HStack {
                    Image(systemName: "antenna.radiowaves.left.and.right")
                        .foregroundColor(mqttManager.isConnected ? .green : .red)
                        .font(.title2)
                        .symbolEffect(.bounce, value: mqttManager.isConnected)
                    
                    Text("HARDHACK 2026")
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundColor(.gray)
                        .bold()
                    
                    Spacer()
                    
                    // Connection Status Pill
                    HStack(spacing: 5) {
                        Circle()
                            .fill(mqttManager.isConnected ? Color.green : Color.red)
                            .frame(width: 8, height: 8)
                        Text(mqttManager.isConnected ? "ONLINE" : "OFFLINE")
                            .font(.caption2.bold())
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Capsule().stroke(mqttManager.isConnected ? Color.green : Color.red, lineWidth: 1))
                }
                .padding([.horizontal, .top])

                Spacer()
                
                // --- TEAM BRANDING ---
                Text("WATT'S UP?")
                    .font(.system(size: 42, weight: .black, design: .rounded))
                    .foregroundColor(Color(red: 1.0, green: 0.9, blue: 0.0)) // Electric Yellow
                    .shadow(color: Color.yellow.opacity(0.6), radius: 10, x: 0, y: 0)
                    .padding(.bottom, 5)

                // --- MAIN CONTROLLER ---
                VStack(spacing: 30) {
                    Image(systemName: isArmed ? "exclamationmark.shield.fill" : "shield.check.fill")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 100, height: 100)
                        .foregroundColor(isArmed ? .red : .green)
                        .shadow(color: isArmed ? .red.opacity(0.5) : .green.opacity(0.5), radius: 20)
                        .animation(.spring(), value: isArmed)

                    VStack(spacing: 5) {
                        Text(isArmed ? "SYSTEM ARMED" : "SYSTEM SECURE")
                            .font(.system(.title2, design: .rounded))
                            .bold()
                            .foregroundColor(.white)
                        
                        Text(isArmed ? "Motion triggers siren" : "Monitoring standby")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }

                    // The Big Switch
                    Toggle("", isOn: $isArmed)
                        .labelsHidden()
                        .toggleStyle(SwitchToggleStyle(tint: .red))
                        .scaleEffect(2.5)
                        .frame(height: 70)
                        .onChange(of: isArmed) { oldValue, newValue in
                            let payload = newValue ? "ON" : "OFF"
                            sendCommand(payload)
                        }
                }
                .padding(35)
                .background(Material.ultraThinMaterial)
                .cornerRadius(30)
                .overlay(
                    RoundedRectangle(cornerRadius: 30)
                        .stroke(LinearGradient(colors: [.white.opacity(0.2), .clear], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.3), radius: 15, y: 10)

                Spacer()

                // --- LIVE LOG CONSOLE ---
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "terminal.fill")
                            .font(.caption)
                        Text("LIVE TRANSMISSION LOG")
                            .font(.caption.bold())
                    }
                    .foregroundColor(.gray)
                    .padding(.leading, 5)
                    
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(alignment: .leading, spacing: 2) {
                                ForEach(commandLogs, id: \.self) { log in
                                    Text(log)
                                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                                        .foregroundColor(.green)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .id(log)
                                }
                            }
                            .padding(10)
                        }
                        .frame(height: 100)
                        .background(Color(red: 0.05, green: 0.05, blue: 0.05))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.green.opacity(0.2), lineWidth: 1)
                        )
                        .onChange(of: commandLogs) {
                            if let last = commandLogs.last {
                                withAnimation { proxy.scrollTo(last, anchor: .bottom) }
                            }
                        }
                    }
                }
                .padding(.horizontal)
                
                // --- CREDITS & RESET ---
                VStack(spacing: 15) {
                    // Panic Button
                    Button {
                        mqttManager.forceReset()
                        addToLog("⚠️ FORCE RESET TRIGGERED")
                        let generator = UINotificationFeedbackGenerator()
                        generator.notificationOccurred(.warning)
                    } label: {
                        HStack {
                            Image(systemName: "arrow.clockwise.circle.fill")
                            Text("Reset Network Link")
                        }
                        .font(.caption)
                        .foregroundColor(.gray.opacity(0.6))
                    }
                    
                    // TEAM CREDITS
                    Text("Created by Brent Brewster, Alex Moralex, Aarnav Munshi & David Brin")
                        .font(.system(size: 9, weight: .medium, design: .monospaced))
                        .foregroundColor(.white.opacity(0.3))
                        .multilineTextAlignment(.center)
                        .padding(.bottom, 5)
                }
                .padding(.vertical)
            }
        }
        .onAppear {
            mqttManager.setup()
            addToLog("> System Initialized. Standing by.")
        }
        .preferredColorScheme(.dark)
    }

    func sendCommand(_ msg: String) {
        mqttManager.publish(topic: topic, message: msg)
        
        // Log formatting
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        let timestamp = formatter.string(from: Date())
        addToLog("[\(timestamp)] >> TX payload: \(msg)")
        
        // Haptics
        let generator = UIImpactFeedbackGenerator(style: .heavy)
        generator.impactOccurred()
    }
    
    func addToLog(_ text: String) {
        commandLogs.append(text)
        if commandLogs.count > 50 { commandLogs.removeFirst() }
    }
}
