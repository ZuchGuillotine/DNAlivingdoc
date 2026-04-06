/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 11/06/2025 - 23:29:32
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 11/06/2025
    * - Author          : 
    * - Modification    : 
**/
import { Link } from "wouter";
import React from "react";

interface FooterProps {
  className?: string;
}

export default function Footer({ className = '' }: FooterProps) {
  return (
    <footer className={`bg-[#1b4332] text-white py-8 mt-auto ${className}`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div>
            <span className="text-lg font-semibold">StackTracker</span>
          </div>
          <nav className="flex space-x-6">
            <Link href="/terms-of-service">
              <span className="text-white/80 hover:text-white transition-colors cursor-pointer">
                Terms of Service
              </span>
            </Link>
            <Link href="/privacy-policy">
              <span className="text-white/80 hover:text-white transition-colors cursor-pointer">
                Privacy Policy
              </span>
            </Link>
            <Link href="/contact">
              <span className="text-white/80 hover:text-white transition-colors cursor-pointer">
                Contact
              </span>
            </Link>
          </nav>
        </div>
        <div className="mt-6 text-center text-white/60 text-sm">
          © {new Date().getFullYear()} StackTracker. All rights reserved.
        </div>
      </div>
    </footer>
  );
} 