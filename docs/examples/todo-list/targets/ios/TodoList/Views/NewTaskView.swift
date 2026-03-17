// Todo List — generated from Spectacular spec

import SwiftUI

struct NewTaskView: View {
    let listId: UUID
    @EnvironmentObject var dataService: DataService
    @EnvironmentObject var notificationService: NotificationService
    @Environment({\.dismiss}) var dismiss
    
    @State private var title = ""
    @State private var notes = ""
    @State private var dueDate = Calendar.current.date(bySettingHour: 17, minute: 0, second: 0, of: Date()) ?? Date()
    @State private var hasDueDate = false
    @State private var priority: Task.Priority = .low
    @State private var selectedListId: UUID
    @State private var additionalReminders: [Date] = []
    @State private var showingReminderPicker = false
    
    init(listId: UUID) {
        self.listId = listId
        self._selectedListId = State(initialValue: listId)
    }
    
    var body: some View {
        NavigationView {
            Form {
                Section {
                    TextField("Task title", text: $title, axis: .vertical)
                        .lineLimit(1...3)
                } header: {
                    Text("Title")
                } footer: {
                    if title.count > 200 {
                        Text("Title too long (\(title.count)/200)")
                            .foregroundColor(.red)
                    }
                }
                
                Section("Details") {
                    // Due Date
                    Toggle("Due date", isOn: $hasDueDate)
                    
                    if hasDueDate {
                        DatePicker("Due date", selection: $dueDate, displayedComponents: [.date, .time])
                    }
                    
                    // Priority
                    Picker("Priority", selection: $priority) {
                        ForEach(Task.Priority.allCases, id: \.self) { priority in
                            HStack {
                                if priority != .low {
                                    Circle()
                                        .fill(priority.color)
                                        .frame(width: 8, height: 8)
                                }
                                Text(priority.displayName)
                            }
                            .tag(priority)
                        }
                    }
                    
                    // List Selection
                    Picker("List", selection: $selectedListId) {
                        ForEach(dataService.lists, id: \.id) { list in
                            HStack {
                                Circle()
                                    .fill(list.color ?? .blue)
                                    .frame(width: 12, height: 12)
                                Text(list.name)
                            }
                            .tag(list.id)
                        }
                    }
                }
                
                // Reminders Section
                if hasDueDate {
                    Section("Reminders") {
                        HStack {
                            Text("Default reminder")
                            Spacer()
                            Text("9:00 AM on due date")
                                .foregroundColor(.secondary)
                        }
                        
                        ForEach(Array(additionalReminders.enumerated()), id: \.offset) { index, reminderTime in
                            HStack {
                                Text("Additional reminder \(index + 1)")
                                Spacer()
                                Text(reminderTime, style: .time)
                                    .foregroundColor(.secondary)
                                Button("Remove") {
                                    additionalReminders.remove(at: index)
                                }
                                .font(.caption)
                                .foregroundColor(.red)
                            }
                        }
                        
                        if additionalReminders.count < 2 {
                            Button("Add reminder") {
                                showingReminderPicker = true
                            }
                            .foregroundColor(.blue)
                        }
                    } footer: {
                        Text("You can set up to 2 additional reminders per task.")
                    }
                }
                
                Section {
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3...10)
                } header: {
                    Text("Notes (Optional)")
                } footer: {
                    if notes.count > 5000 {
                        Text("Notes too long (\(notes.count)/5000)")
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Add") {
                        addTask()
                    }
                    .disabled(!canAddTask)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .sheet(isPresented: $showingReminderPicker) {
            ReminderPickerView { reminderTime in
                additionalReminders.append(reminderTime)
            }
        }
    }
    
    private var canAddTask: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        title.count <= 200 &&
        notes.count <= 5000
    }
    
    private func addTask() {
        let task = Task(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            listId: selectedListId,
            priority: priority,
            dueDate: hasDueDate ? dueDate : nil,
            notes: notes.isEmpty ? nil : notes
        )
        
        dataService.addTask(task)
        
        // Schedule notifications if due date is set
        if hasDueDate {
            scheduleNotifications(for: task)
        }
        
        // Request notification permission if this is the first task with a due date
        if hasDueDate && !notificationService.isAuthorized {
            Task {
                await notificationService.requestPermission()
            }
        }
        
        dismiss()
    }
    
    private func scheduleNotifications(for task: Task) {
        guard let dueDate = task.dueDate else { return }
        
        // Default reminder at 9:00 AM on due date
        let calendar = Calendar.current
        let reminderDate = calendar.date(bySettingHour: 9, minute: 0, second: 0, of: dueDate) ?? dueDate
        
        notificationService.scheduleReminder(for: task, at: reminderDate)
        
        // Additional reminders
        for reminderTime in additionalReminders {
            notificationService.scheduleReminder(for: task, at: reminderTime)
        }
    }
}

struct ReminderPickerView: View {
    let onReminderSelected: (Date) -> Void
    @Environment({\.dismiss}) var dismiss
    @State private var selectedTime = Date()
    @State private var reminderType: ReminderType = .onDueDate
    
    enum ReminderType: String, CaseIterable {
        case onDueDate = "On due date"
        case hoursBefore = "Hours before"
        case daysBefore = "Days before"
    }
    
    var body: some View {
        NavigationView {
            Form {
                Section("Reminder Time") {
                    Picker("Type", selection: $reminderType) {
                        ForEach(ReminderType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                    
                    switch reminderType {
                    case .onDueDate:
                        DatePicker("Time", selection: $selectedTime, displayedComponents: .hourAndMinute)
                    case .hoursBefore:
                        Stepper("\(Int(selectedTime.timeIntervalSinceNow / 3600)) hours before", value: .constant(1), in: 1...24)
                    case .daysBefore:
                        Stepper("\(Int(selectedTime.timeIntervalSinceNow / 86400)) days before", value: .constant(1), in: 1...7)
                    }
                }
            }
            .navigationTitle("Add Reminder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Add") {
                        onReminderSelected(selectedTime)
                        dismiss()
                    }
                }
            }
        }
    }
}

struct NewTaskView_Previews: PreviewProvider {
    static var previews: some View {
        NewTaskView(listId: UUID())
            .environmentObject(DataService())
            .environmentObject(NotificationService())
    }
}