// Todo List — generated from Spectacular spec

import SwiftUI

struct TaskSearchView: View {
    @EnvironmentObject var dataService: DataService
    @Environment(\.dismiss) var dismiss
    @State private var searchText = ""
    @State private var selectedTask: Task?
    @FocusState private var isSearchFocused: Bool
    
    var filteredTasks: [Task] {
        if searchText.isEmpty {
            return dataService.tasks.sorted { task1, task2 in
                if task1.isCompleted != task2.isCompleted {
                    return !task1.isCompleted
                }
                return task1.updatedAt > task2.updatedAt
            }
        } else {
            return dataService.tasks.filter { task in
                task.title.localizedCaseInsensitiveContains(searchText) ||
                (task.notes?.localizedCaseInsensitiveContains(searchText) ?? false)
            }.sorted { task1, task2 in
                if task1.isCompleted != task2.isCompleted {
                    return !task1.isCompleted
                }
                return task1.updatedAt > task2.updatedAt
            }
        }
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search Bar
                HStack {
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                        
                        TextField("Search tasks...", text: $searchText)
                            .focused($isSearchFocused)
                            .textFieldStyle(.plain)
                        
                        if !searchText.isEmpty {
                            Button("Clear") {
                                searchText = ""
                            }
                            .font(.caption)
                            .foregroundColor(.blue)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                    
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.blue)
                }
                .padding()
                
                // Results
                if filteredTasks.isEmpty {
                    emptyResultsView
                } else {
                    resultsList
                }
                
                Spacer()
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarHidden(true)
        }
        .sheet(item: $selectedTask) { task in
            NavigationView {
                TaskDetailView(task: task)
                    .environmentObject(dataService)
                    .environmentObject(NotificationService())
            }
        }
        .onAppear {
            isSearchFocused = true
        }
    }
    
    private var emptyResultsView: some View {
        VStack(spacing: 16) {
            Image(systemName: searchText.isEmpty ? "magnifyingglass" : "doc.text.magnifyingglass")
                .font(.system(size: 50))
                .foregroundColor(.gray)
            
            if searchText.isEmpty {
                Text("Start typing to search")
                    .font(.title2)
                    .fontWeight(.medium)
                
                Text("Search through all your tasks and notes")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            } else {
                Text("No results found")
                    .font(.title2)
                    .fontWeight(.medium)
                
                Text("Try a different search term")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
    
    private var resultsList: some View {
        List {
            ForEach(filteredTasks) { task in
                SearchTaskResultRow(task: task, searchText: searchText) {
                    selectedTask = task
                }
                .environmentObject(dataService)
            }
        }
        .listStyle(.plain)
    }
}

struct SearchTaskResultRow: View {
    let task: Task
    let searchText: String
    let onTap: () -> Void
    @EnvironmentObject var dataService: DataService
    
    private var listName: String {
        dataService.lists.first(where: { $0.id == task.listId })?.name ?? "Unknown"
    }
    
    private func highlightedText(_ text: String, searchTerm: String) -> Text {
        let lowercaseText = text.lowercased()
        let lowercaseSearchTerm = searchTerm.lowercased()
        
        guard lowercaseText.contains(lowercaseSearchTerm) else {
            return Text(text)
        }
        
        let range = lowercaseText.range(of: lowercaseSearchTerm)
        guard let range = range else {
            return Text(text)
        }
        
        let beforeMatch = String(text[text.startIndex..<range.lowerBound])
        let match = String(text[range.lowerBound..<range.upperBound])
        let afterMatch = String(text[range.upperBound...])
        
        return Text(beforeMatch) + Text(match).foregroundColor(.blue).fontWeight(.medium) + Text(afterMatch)
    }
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Completion Checkbox
                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundColor(task.isCompleted ? .green : .gray)
                
                VStack(alignment: .leading, spacing: 4) {
                    // Title with highlighting
                    HStack {
                        if task.title.localizedCaseInsensitiveContains(searchText) {
                            highlightedText(task.title, searchTerm: searchText)
                                .font(.body)
                                .strikethrough(task.isCompleted)
                                .foregroundColor(task.isCompleted ? .secondary : .primary)
                                .multilineTextAlignment(.leading)
                        } else {
                            Text(task.title)
                                .font(.body)
                                .strikethrough(task.isCompleted)
                                .foregroundColor(task.isCompleted ? .secondary : .primary)
                                .multilineTextAlignment(.leading)
                        }
                        
                        Spacer()
                        
                        // Priority Indicator
                        if task.priority != .low {
                            Circle()
                                .fill(task.priority.color)
                                .frame(width: 8, height: 8)
                        }
                    }
                    
                    // List and Due Date
                    HStack {
                        Text(listName)
                            .font(.caption)
                            .foregroundColor(.blue)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(.blue.opacity(0.1)))
                        
                        if let dueDateText = task.dueDateText {
                            Text(dueDateText)
                                .font(.caption)
                                .foregroundColor(task.isOverdue ? .red : .secondary)
                        }
                        
                        Spacer()
                    }
                    
                    // Notes preview with highlighting
                    if let notes = task.notes, !notes.isEmpty {
                        if notes.localizedCaseInsensitiveContains(searchText) {
                            highlightedText(notes, searchTerm: searchText)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                        } else {
                            Text(notes)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                        }
                    }
                }
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct TaskSearchView_Previews: PreviewProvider {
    static var previews: some View {
        TaskSearchView()
            .environmentObject(DataService())
    }
}