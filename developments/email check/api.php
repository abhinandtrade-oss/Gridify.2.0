<?php
session_start();

// PHPMailer classes
require 'PHPMailer-6.9.1/src/Exception.php';
require 'PHPMailer-6.9.1/src/PHPMailer.php';
require 'PHPMailer-6.9.1/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

header('Content-Type: application/json');

$action = $_POST['action'] ?? '';

if ($action === 'send_otp') {
    $email = $_POST['email'] ?? '';
    if (empty($email)) {
        echo json_encode(['success' => false, 'message' => 'Email is required']);
        exit;
    }

    // Generate 6-digit OTP
    $otp = rand(100000, 999999);
    $_SESSION['otp'] = $otp;
    $_SESSION['otp_email'] = $email;
    $_SESSION['otp_time'] = time();

    // Send Email using PHPMailer
    $mail = new PHPMailer(true);

    try {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'dream.hr.co@gmail.com';
        $mail->Password   = 'jjwk ocur vipt hmcu'; // Gmail App Password
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        // Recipients
        $mail->setFrom('dream.hr.co@gmail.com', 'Dream HR');
        $mail->addAddress($email);

        // Content
        $mail->isHTML(true);
        $mail->Subject = 'Your OTP for Dream HR Verification';
        
        $mailContent = "
        <div style='font-family: sans-serif; padding: 20px; color: #333; max-width: 500px; border: 1px solid #eee; border-radius: 12px;'>
            <h2 style='color: #6366f1;'>Email Verification</h2>
            <p>Verification code for your Dream HR account:</p>
            <div style='font-size: 32px; font-weight: bold; color: #6366f1; letter-spacing: 5px; margin: 20px 0; text-align: center;'>$otp</div>
            <p style='font-size: 0.9rem; color: #666;'>This code will expire in 10 minutes. Please do not share it with anyone.</p>
            <hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;'>
            <p style='font-size: 0.8rem; color: #999;'>&copy; 2025 Dream HR. All rights reserved.</p>
        </div>";

        $mail->Body = $mailContent;

        $mail->send();
        echo json_encode(['success' => true, 'message' => 'OTP sent successfully to ' . $email]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => "Message could not be sent. Mailer Error: {$mail->ErrorInfo}"]);
    }
    exit;
}

if ($action === 'verify_otp') {
    $input_otp = $_POST['otp'] ?? '';
    $email = $_POST['email'] ?? '';

    if (empty($input_otp)) {
        echo json_encode(['success' => false, 'message' => 'OTP is required']);
        exit;
    }

    if (isset($_SESSION['otp']) && $_SESSION['otp'] == $input_otp) {
        if (time() - $_SESSION['otp_time'] > 600) {
            echo json_encode(['success' => false, 'message' => 'OTP has expired']);
            exit;
        }

        if ($_SESSION['otp_email'] !== $email) {
            echo json_encode(['success' => false, 'message' => 'Email mismatch']);
            exit;
        }

        unset($_SESSION['otp']);
        unset($_SESSION['otp_email']);
        unset($_SESSION['otp_time']);

        echo json_encode(['success' => true, 'message' => 'Verified successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid OTP']);
    }
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
?>
