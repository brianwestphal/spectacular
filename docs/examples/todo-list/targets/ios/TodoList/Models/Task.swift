// Todo List — generated from Spectacular spec

import Foundation
import SwiftUI

struct Task: Identifiable, Codable, Hashable {
    let id = UUID()
    var title: String
    var isCompleted: Bool
    var dueDate: Date?
    var priority: Priority
    var notes: String?
    var listId: UUID
    var createdAt: Date
    var updatedAt: Date
    
    enum Priority: String, CaseIterable, Codable {
        case low = "low"
        case medium = "medium"
        case high = "high"
        
        var color: Color {
            switch self {
            case .low:
                return .clear
            case .medium:
                return .orange
            case .high:
                return .red
            }
        }
        
        var displayName: String {
            rawValue.capitalized
        }
    }
    
    init(title: String, listId: UUID, priority: Priority = .low, dueDate: Date? = nil, notes: String? = nil) {
        self.title = title
        self.isCompleted = false
        self.dueDate = dueDate
        self.priority = priority
        self.notes = notes
        self.listId = listId
        self.createdAt = Date()
        self.updatedAt = Date()
    }
    
    var dueDateText: String? {
        guard let dueDate = dueDate else { return nil }
        
        let calendar = Calendar.current
        let now = Date()
        
        if calendar.isDate(dueDate, inSameDayAs: now) {
            return "Today"
        } else if calendar.isDate(dueDate, inSameDayAs: calendar.date(byAdding: .day, value: 1, to: now) ?? now) {
            return "Tomorrow"
        } else if calendar.isDate(dueDate, inSameDayAs: calendar.date(byAdding: .day, value: -1, to: now) ?? now) {
            return "Yesterday"
        } else {
            let daysDiff = calendar.dateComponents([.day], from: now, to: dueDate).day ?? 0
            if abs(daysDiff) <= 7 {
                if daysDiff > 0 {
                    return "In \(daysDiff) day\(daysDiff == 1 ? "" : "s")"
                } else {
                    return "\(abs(daysDiff)) day\(abs(daysDiff) == 1 ? "" : "s") ago"
                }
            } else {
                let formatter = DateFormatter()
                formatter.dateStyle = .medium
                return formatter.string(from: dueDate)
            }
        }
    }
    
    var isOverdue: Bool {
        guard let dueDate = dueDate else { return false }
        return !isCompleted && dueDate < Date()
    }
}