CREATE DATABASE k3l_rentals;

USE k3l_rentals;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    phone VARCHAR(20)
);

CREATE TABLE vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_number VARCHAR(50) NOT NULL UNIQUE,
    model VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    price_per_day DECIMAL(10,2) NOT NULL,
    location VARCHAR(100),
    status VARCHAR(50) DEFAULT 'available',
    image VARCHAR(500)
);

CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_amount DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending',

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE TABLE maintenance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    service_date DATE,
    next_service_date DATE,
    description TEXT,
    status VARCHAR(50),

    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

USE k3l_rentals;

INSERT INTO users
(name, email, password, role, phone)
VALUES
('Test User', 'test@example.com', '123456', 'user', '9876543210');